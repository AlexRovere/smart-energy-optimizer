import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useTraining } from '../../app/composables/useTraining'

const mockFetch = vi.hoisted(() => vi.fn())
mockNuxtImport('$fetch', () => mockFetch)

const inProgressResponse = { in_progress: true, last: null }
const successResponse = {
  in_progress: false,
  last: { status: 'success', started_at: '2026-09-23T10:00:00Z', finished_at: '2026-09-23T10:02:00Z' },
}
const errorResponse = {
  in_progress: false,
  last: { status: 'error', started_at: '2026-09-23T10:00:00Z', finished_at: '2026-09-23T10:00:05Z', message: 'Données invalides' },
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

  it('lastTraining=null au départ', () => {
    const { lastTraining } = useTraining()
    expect(lastTraining.value).toBeNull()
  })

  describe('déclencher', () => {
    it('appelle POST /api/training', async () => {
      mockFetch.mockResolvedValueOnce({ status: 'démarré' })
      mockFetch.mockResolvedValue(inProgressResponse)

      const { trigger } = useTraining()
      await trigger()

      expect(mockFetch).toHaveBeenCalledWith('/api/training', expect.objectContaining({ method: 'POST' }))
    })

    it('passe pending à true immédiatement après le déclenchement', async () => {
      mockFetch.mockResolvedValueOnce({ status: 'démarré' })
      mockFetch.mockResolvedValue(inProgressResponse)

      const { trigger, pending } = useTraining()
      await trigger()

      expect(pending.value).toBe(true)
    })

    it('polling met à jour le statut après un entraînement réussi', async () => {
      mockFetch.mockResolvedValueOnce({ status: 'démarré' })
      mockFetch.mockResolvedValueOnce(successResponse)

      const { trigger, lastTraining, pending } = useTraining()
      await trigger()

      await vi.advanceTimersByTimeAsync(3000)

      expect(pending.value).toBe(false)
      expect(lastTraining.value?.status).toBe('success')
      expect(lastTraining.value?.finishedAt).toBeInstanceOf(Date)
    })

    it('polling met à jour le statut et le message après un échec', async () => {
      mockFetch.mockResolvedValueOnce({ status: 'démarré' })
      mockFetch.mockResolvedValueOnce(errorResponse)

      const { trigger, lastTraining, pending } = useTraining()
      await trigger()

      await vi.advanceTimersByTimeAsync(3000)

      expect(pending.value).toBe(false)
      expect(lastTraining.value?.status).toBe('error')
      expect(lastTraining.value?.message).toBe('Données invalides')
    })

    it('continue à poller tant que in_progress est true', async () => {
      mockFetch.mockResolvedValueOnce({ status: 'démarré' })
      mockFetch.mockResolvedValueOnce(inProgressResponse)
      mockFetch.mockResolvedValueOnce(successResponse)

      const { trigger, pending } = useTraining()
      await trigger()

      await vi.advanceTimersByTimeAsync(3000)
      expect(pending.value).toBe(true)

      await vi.advanceTimersByTimeAsync(3000)
      expect(pending.value).toBe(false)
    })
  })

  describe('rafraichir', () => {
    it('passe pending à false quand in_progress est false', async () => {
      mockFetch.mockResolvedValueOnce(successResponse)

      const { reload, pending } = useTraining()
      pending.value = true
      await reload()

      expect(pending.value).toBe(false)
    })

    it('met à jour lastTraining depuis la réponse du serveur', async () => {
      mockFetch.mockResolvedValueOnce(successResponse)

      const { reload, lastTraining } = useTraining()
      await reload()

      expect(lastTraining.value?.status).toBe('success')
      expect(lastTraining.value?.finishedAt).toBeInstanceOf(Date)
    })

    it('transmet le message d\'erreur dans lastTraining', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse)

      const { reload, lastTraining } = useTraining()
      await reload()

      expect(lastTraining.value?.status).toBe('error')
      expect(lastTraining.value?.message).toBe('Données invalides')
    })

    it('laisse pending à true quand in_progress est toujours vrai', async () => {
      mockFetch.mockResolvedValueOnce(inProgressResponse)

      const { reload, pending } = useTraining()
      pending.value = true
      await reload()

      expect(pending.value).toBe(true)
    })
  })
})
