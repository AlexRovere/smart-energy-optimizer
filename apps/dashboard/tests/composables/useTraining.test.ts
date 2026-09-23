import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useTraining } from '../../app/composables/useTraining'

const mockFetch = vi.hoisted(() => vi.fn())
mockNuxtImport('$fetch', () => mockFetch)

describe('useTraining', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('pending=false au départ', () => {
    const { pending } = useTraining()
    expect(pending.value).toBe(false)
  })

  it('dernierEntrainement=null au départ', () => {
    const { dernierEntrainement } = useTraining()
    expect(dernierEntrainement.value).toBeNull()
  })

  it('appelle POST /api/training', async () => {
    mockFetch.mockResolvedValue({ status: 'started' })

    const { déclencher } = useTraining()
    await déclencher()

    expect(mockFetch).toHaveBeenCalledWith('/api/training', expect.objectContaining({ method: 'POST' }))
  })

  it('dernierEntrainement.statut=succès après un appel réussi', async () => {
    mockFetch.mockResolvedValue({ status: 'started' })

    const { déclencher, dernierEntrainement } = useTraining()
    await déclencher()

    expect(dernierEntrainement.value?.statut).toBe('succès')
  })

  it('dernierEntrainement.à est une Date après un appel réussi', async () => {
    mockFetch.mockResolvedValue({ status: 'started' })

    const { déclencher, dernierEntrainement } = useTraining()
    await déclencher()

    expect(dernierEntrainement.value?.à).toBeInstanceOf(Date)
  })

  it('dernierEntrainement.statut=erreur si le service échoue', async () => {
    mockFetch.mockRejectedValue(new Error('503 Service Unavailable'))

    const { déclencher, dernierEntrainement } = useTraining()
    await déclencher()

    expect(dernierEntrainement.value?.statut).toBe('erreur')
  })

  it('dernierEntrainement.à est une Date même en cas d\'erreur', async () => {
    mockFetch.mockRejectedValue(new Error('503 Service Unavailable'))

    const { déclencher, dernierEntrainement } = useTraining()
    await déclencher()

    expect(dernierEntrainement.value?.à).toBeInstanceOf(Date)
  })

  it('pending revient à false après un appel réussi', async () => {
    mockFetch.mockResolvedValue({ status: 'started' })

    const { déclencher, pending } = useTraining()
    await déclencher()

    expect(pending.value).toBe(false)
  })

  it('pending revient à false après une erreur', async () => {
    mockFetch.mockRejectedValue(new Error('503'))

    const { déclencher, pending } = useTraining()
    await déclencher()

    expect(pending.value).toBe(false)
  })
})
