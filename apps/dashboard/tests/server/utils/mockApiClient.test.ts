import { beforeEach, describe, expect, it, vi } from 'vitest'
import { $fetch } from 'ofetch'
import { fetchMockApi } from '../../../server/utils/mockApiClient'

vi.mock('ofetch', () => ({
  $fetch: vi.fn(),
}))

const BASE_URL = 'http://mock-api'
const PATH = '/api/v1/sites/SITE001/current'
const BODY = { site_id: 'SITE001', timestamp: '2026-09-16T14:00:00Z' }

// L'API Mock du formateur porte son authentification dans l'URL. Le `fetch` de
// Node refuse ce format, donc le client doit la déplacer dans un en-tête.
const UTILISATEUR = 'utilisateur'
const MOT_DE_PASSE = 'mot-de-passe'
const BASE_URL_AVEC_IDENTIFIANTS = `http://${UTILISATEUR}:${MOT_DE_PASSE}@mock-api`
const EN_TETE_ATTENDU = `Basic ${Buffer.from(`${UTILISATEUR}:${MOT_DE_PASSE}`).toString('base64')}`

const mocked$fetch = vi.mocked($fetch)

describe('fetchMockApi', () => {
  let sleepSpy: ReturnType<typeof vi.fn<(ms: number) => Promise<void>>>

  beforeEach(() => {
    vi.resetAllMocks()
    sleepSpy = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined)
  })

  // ── Cas de succès ──────────────────────────────────────────────────────

  it('retourne le body au 1er appel réussi', async () => {
    mocked$fetch.mockResolvedValueOnce(BODY)

    const result = await fetchMockApi(PATH, BASE_URL, { sleepFn: sleepSpy })

    expect(result).toEqual(BODY)
    expect(mocked$fetch).toHaveBeenCalledTimes(1)
    expect(sleepSpy).not.toHaveBeenCalled()
  })

  it('transmet path et baseURL à $fetch', async () => {
    mocked$fetch.mockResolvedValueOnce(BODY)

    await fetchMockApi(PATH, BASE_URL, { sleepFn: sleepSpy })

    expect(mocked$fetch).toHaveBeenCalledWith(
      PATH,
      expect.objectContaining({ baseURL: BASE_URL }),
    )
  })

  it('transmet un AbortSignal à $fetch', async () => {
    mocked$fetch.mockResolvedValueOnce(BODY)

    await fetchMockApi(PATH, BASE_URL, { sleepFn: sleepSpy })

    expect(mocked$fetch).toHaveBeenCalledWith(
      PATH,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  // ── Retry ──────────────────────────────────────────────────────────────

  it('réessaie et réussit à la 2e tentative', async () => {
    mocked$fetch
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(BODY)

    const result = await fetchMockApi(PATH, BASE_URL, { sleepFn: sleepSpy })

    expect(result).toEqual(BODY)
    expect(mocked$fetch).toHaveBeenCalledTimes(2)
    expect(sleepSpy).toHaveBeenCalledTimes(1)
    expect(sleepSpy).toHaveBeenCalledWith(1000)
  })

  it('réessaie et réussit à la 3e tentative', async () => {
    mocked$fetch
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(BODY)

    const result = await fetchMockApi(PATH, BASE_URL, { sleepFn: sleepSpy })

    expect(result).toEqual(BODY)
    expect(mocked$fetch).toHaveBeenCalledTimes(3)
    expect(sleepSpy).toHaveBeenCalledTimes(2)
    expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000)
    expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000)
  })

  // ── Échec total → 503 ──────────────────────────────────────────────────

  it('lève H3Error 503 après 3 échecs consécutifs', async () => {
    mocked$fetch.mockRejectedValue(new Error('network error'))

    await expect(fetchMockApi(PATH, BASE_URL, { sleepFn: sleepSpy }))
      .rejects.toMatchObject({ statusCode: 503 })

    expect(mocked$fetch).toHaveBeenCalledTimes(3)
  })

  it('backoff exponentiel : délais 1 000 ms puis 2 000 ms, pas de 3e pause', async () => {
    mocked$fetch.mockRejectedValue(new Error('network error'))

    await expect(fetchMockApi(PATH, BASE_URL, { sleepFn: sleepSpy })).rejects.toThrow()

    expect(sleepSpy).toHaveBeenCalledTimes(2)
    expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000)
    expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000)
  })

  // ── Authentification portée par l'URL ──────────────────────────────────

  it('déplace dans un en-tête Authorization les identifiants portés par la base', async () => {
    mocked$fetch.mockResolvedValueOnce(BODY)

    await fetchMockApi(PATH, BASE_URL_AVEC_IDENTIFIANTS, { sleepFn: sleepSpy })

    expect(mocked$fetch).toHaveBeenCalledWith(
      PATH,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: EN_TETE_ATTENDU }),
      }),
    )
  })

  it('appelle une base débarrassée de ses identifiants', async () => {
    mocked$fetch.mockResolvedValueOnce(BODY)

    await fetchMockApi(PATH, BASE_URL_AVEC_IDENTIFIANTS, { sleepFn: sleepSpy })

    const options = mocked$fetch.mock.calls[0]?.[1]
    expect(options?.baseURL).not.toContain(MOT_DE_PASSE)
    expect(options?.baseURL).toContain('mock-api')
  })

  it('ne pose aucun en-tête Authorization quand la base ne porte pas d identifiants', async () => {
    mocked$fetch.mockResolvedValueOnce(BODY)

    await fetchMockApi(PATH, BASE_URL, { sleepFn: sleepSpy })

    const options = mocked$fetch.mock.calls[0]?.[1]
    expect(options?.headers ?? {}).not.toHaveProperty('Authorization')
    expect(options?.baseURL).toBe(BASE_URL)
  })

  it('ne laisse pas le mot de passe filtrer dans l erreur rendue', async () => {
    // `fetch` recrache l'URL entière dans son message, identifiants compris.
    mocked$fetch.mockRejectedValue(
      new Error(`Request cannot be constructed from a URL that includes credentials: ${BASE_URL_AVEC_IDENTIFIANTS}/`),
    )

    // `never` en type de retour : la promesse ne peut que rejeter ici, donc
    // `erreur` porte le type de l'erreur et non une union avec le succès.
    const erreur = await fetchMockApi<never>(PATH, BASE_URL_AVEC_IDENTIFIANTS, { sleepFn: sleepSpy })
      .catch((e: unknown) => e as { statusCode?: number, cause?: unknown })

    expect(erreur.statusCode).toBe(503)
    expect(JSON.stringify(erreur.cause ?? '')).not.toContain(MOT_DE_PASSE)
    expect(String((erreur.cause as Error | undefined)?.message ?? '')).not.toContain(MOT_DE_PASSE)
  })
})
