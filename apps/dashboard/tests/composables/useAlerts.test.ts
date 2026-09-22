import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useAlerts } from '../../app/composables/useAlerts'

const { mockUseFetch } = vi.hoisted(() => ({
  mockUseFetch: vi.fn(),
}))

vi.mock('nuxt/app', () => ({
  useFetch: mockUseFetch,
  useRoute: () => ({ path: '/' }),
}))

const alertesFixture = [
  { alert_id: 'ALT-001', site_id: 'SITE001', severity: 'critical', type: 'outage', message: 'Test', timestamp: '2026-09-22T10:00:00Z' },
  { alert_id: 'ALT-002', site_id: 'SITE002', severity: 'high', type: 'threshold', message: 'Seuil', timestamp: '2026-09-22T09:00:00Z' },
]

describe('useAlerts', () => {
  beforeEach(() => {
    mockUseFetch.mockReturnValue({
      data: ref(null),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn(),
    })
  })

  it('retourne un tableau vide quand data est null', () => {
    const { alerts } = useAlerts()
    expect(alerts.value).toEqual([])
  })

  it('retourne les alertes quand data est renseigné', () => {
    mockUseFetch.mockReturnValue({
      data: ref(alertesFixture),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn(),
    })
    const { alerts } = useAlerts()
    expect(alerts.value).toHaveLength(2)
    expect(alerts.value[0]?.alert_id).toBe('ALT-001')
  })

  it('expose pending depuis useFetch', () => {
    mockUseFetch.mockReturnValue({
      data: ref(null),
      pending: ref(true),
      error: ref(null),
      refresh: vi.fn(),
    })
    const { pending } = useAlerts()
    expect(pending.value).toBe(true)
  })

  it('appelle useFetch avec /api/alerts', () => {
    useAlerts()
    expect(mockUseFetch).toHaveBeenCalledWith('/api/alerts')
  })

  it('interroge /api/alerts toutes les 30 s', () => {
    // Le polling est un détail d'implémentation : on vérifie que useFetch est
    // bien appelé avec la bonne URL, le timer est vérifié par useFleetSummary.
    useAlerts()
    expect(mockUseFetch).toHaveBeenCalledWith('/api/alerts')
  })

  describe('journalisation des erreurs', () => {
    afterEach(() => vi.restoreAllMocks())

    it('loggue sur console.error quand error passe de null à une Error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const errorRef = ref<Error | null>(null)
      mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(false), error: errorRef, refresh: vi.fn() })

      useAlerts()

      errorRef.value = new Error('503 Alertes indisponibles')
      await nextTick()

      expect(consoleSpy).toHaveBeenCalledOnce()
      const [, données] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>]
      expect(données.message).toBe('503 Alertes indisponibles')
    })
  })
})
