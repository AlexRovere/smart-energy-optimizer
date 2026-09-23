import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useTraining } from '../../app/composables/useTraining'

const mockFetch = vi.hoisted(() => vi.fn())
mockNuxtImport('$fetch', () => mockFetch)

const réponseEnCours = { en_cours: true, dernier: null }
const réponseSuccès = {
  en_cours: false,
  dernier: { statut: 'succès', début: '2026-09-23T10:00:00Z', fin: '2026-09-23T10:02:00Z' },
}
const réponseErreur = {
  en_cours: false,
  dernier: { statut: 'erreur', début: '2026-09-23T10:00:00Z', fin: '2026-09-23T10:00:05Z', message: 'Données invalides' },
}

describe('useTraining', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pending=false au départ', () => {
    const { pending } = useTraining()
    expect(pending.value).toBe(false)
  })

  it('dernierEntrainement=null au départ', () => {
    const { dernierEntrainement } = useTraining()
    expect(dernierEntrainement.value).toBeNull()
  })

  describe('déclencher', () => {
    it('appelle POST /api/training', async () => {
      mockFetch.mockResolvedValueOnce({ status: 'démarré' })
      mockFetch.mockResolvedValue(réponseEnCours)

      const { déclencher } = useTraining()
      await déclencher()

      expect(mockFetch).toHaveBeenCalledWith('/api/training', expect.objectContaining({ method: 'POST' }))
    })

    it('passe pending à true immédiatement après le déclenchement', async () => {
      mockFetch.mockResolvedValueOnce({ status: 'démarré' })
      mockFetch.mockResolvedValue(réponseEnCours)

      const { déclencher, pending } = useTraining()
      await déclencher()

      expect(pending.value).toBe(true)
    })

    it('polling met à jour le statut après un entraînement réussi', async () => {
      mockFetch.mockResolvedValueOnce({ status: 'démarré' })
      mockFetch.mockResolvedValueOnce(réponseSuccès)

      const { déclencher, dernierEntrainement, pending } = useTraining()
      await déclencher()

      await vi.advanceTimersByTimeAsync(3000)

      expect(pending.value).toBe(false)
      expect(dernierEntrainement.value?.statut).toBe('succès')
      expect(dernierEntrainement.value?.à).toBeInstanceOf(Date)
    })

    it('polling met à jour le statut et le message après un échec', async () => {
      mockFetch.mockResolvedValueOnce({ status: 'démarré' })
      mockFetch.mockResolvedValueOnce(réponseErreur)

      const { déclencher, dernierEntrainement, pending } = useTraining()
      await déclencher()

      await vi.advanceTimersByTimeAsync(3000)

      expect(pending.value).toBe(false)
      expect(dernierEntrainement.value?.statut).toBe('erreur')
      expect(dernierEntrainement.value?.message).toBe('Données invalides')
    })

    it('continue à poller tant que en_cours est true', async () => {
      mockFetch.mockResolvedValueOnce({ status: 'démarré' })
      mockFetch.mockResolvedValueOnce(réponseEnCours)
      mockFetch.mockResolvedValueOnce(réponseSuccès)

      const { déclencher, pending } = useTraining()
      await déclencher()

      await vi.advanceTimersByTimeAsync(3000)
      expect(pending.value).toBe(true)

      await vi.advanceTimersByTimeAsync(3000)
      expect(pending.value).toBe(false)
    })
  })

  describe('rafraichir', () => {
    it('passe pending à false quand en_cours est false', async () => {
      mockFetch.mockResolvedValueOnce(réponseSuccès)

      const { rafraichir, pending } = useTraining()
      pending.value = true
      await rafraichir()

      expect(pending.value).toBe(false)
    })

    it('met à jour dernierEntrainement depuis la réponse du serveur', async () => {
      mockFetch.mockResolvedValueOnce(réponseSuccès)

      const { rafraichir, dernierEntrainement } = useTraining()
      await rafraichir()

      expect(dernierEntrainement.value?.statut).toBe('succès')
      expect(dernierEntrainement.value?.à).toBeInstanceOf(Date)
    })

    it('transmet le message d\'erreur dans dernierEntrainement', async () => {
      mockFetch.mockResolvedValueOnce(réponseErreur)

      const { rafraichir, dernierEntrainement } = useTraining()
      await rafraichir()

      expect(dernierEntrainement.value?.statut).toBe('erreur')
      expect(dernierEntrainement.value?.message).toBe('Données invalides')
    })

    it('laisse pending à true quand en_cours est toujours vrai', async () => {
      mockFetch.mockResolvedValueOnce(réponseEnCours)

      const { rafraichir, pending } = useTraining()
      pending.value = true
      await rafraichir()

      expect(pending.value).toBe(true)
    })
  })
})
