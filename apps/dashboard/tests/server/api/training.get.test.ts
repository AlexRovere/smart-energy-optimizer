import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../server/api/training.get'
import { trainingState, resetTrainingState } from '../../../server/utils/trainingState'

vi.hoisted(() => {
  ;(globalThis as Record<string, unknown>).defineEventHandler = (fn: unknown) => fn
})

const { mockRequireRole } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
}))

vi.mock('../../../server/utils/guard', () => ({
  requireRole: mockRequireRole,
}))

const compteAdmin = { id: 'user-uuid', email: 'admin@enervision.fr', role: 'ADMIN' }
const mockEvent = { path: '/api/training' } as H3Event

describe('GET /api/training', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTrainingState()
    mockRequireRole.mockResolvedValue(compteAdmin)
  })

  it('retourne 403 si le compte n\'est pas ADMIN', async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error('Accès interdit'), { statusCode: 403 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('retourne en_cours false et dernier null à l\'état initial', async () => {
    const résultat = await handler(mockEvent)

    expect(résultat).toEqual({ en_cours: false, dernier: null })
  })

  it('retourne en_cours true pendant un entraînement', async () => {
    trainingState.enCours = true

    const résultat = await handler(mockEvent)

    expect(résultat.en_cours).toBe(true)
  })

  it('retourne le statut succès après un entraînement réussi', async () => {
    const début = new Date('2026-09-23T10:00:00Z')
    const fin = new Date('2026-09-23T10:02:00Z')
    trainingState.dernier = { statut: 'succès', début, fin }

    const résultat = await handler(mockEvent)

    expect(résultat.dernier?.statut).toBe('succès')
    expect(résultat.dernier?.début).toBe(début.toISOString())
    expect(résultat.dernier?.fin).toBe(fin.toISOString())
  })

  it('retourne le statut erreur avec le message après un échec', async () => {
    const début = new Date('2026-09-23T10:00:00Z')
    const fin = new Date('2026-09-23T10:00:05Z')
    trainingState.dernier = { statut: 'erreur', début, fin, message: 'Données invalides' }

    const résultat = await handler(mockEvent)

    expect(résultat.dernier?.statut).toBe('erreur')
    expect(résultat.dernier?.message).toBe('Données invalides')
  })
})
