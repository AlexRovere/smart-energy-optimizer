// @vitest-environment nuxt
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { SiteId } from '../../app/types/api'
import { useFeedback } from '../../app/composables/useFeedback'

const useFetchMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useFetch', () => useFetchMock)

const putBodies: unknown[] = []
registerEndpoint('/api/sites/SITE001/feedback', {
  method: 'PUT',
  handler: async (event) => {
    const { readBody } = await import('h3')
    const body = await readBody(event)
    putBodies.push(body)
    return body
  },
})

describe('useFeedback', () => {
  beforeEach(() => {
    useFetchMock.mockReset()
    putBodies.length = 0
  })

  it('lit les votes du compte sur le site', () => {
    useFetchMock.mockReturnValue({ data: ref([]), refresh: vi.fn() })
    useFeedback(ref<SiteId>('SITE001'))
    const url = useFetchMock.mock.calls[0]![0]
    expect(typeof url === 'function' ? url() : url).toBe('/api/sites/SITE001/feedback')
  })

  it('rend le vote déjà donné pour une cible, rien sinon', () => {
    useFetchMock.mockReturnValue({
      data: ref([{ target_type: 'recommendation', target_id: 'REC-1', useful: false }]),
      refresh: vi.fn(),
    })
    const { voteFor } = useFeedback(ref<SiteId>('SITE001'))

    expect(voteFor('recommendation', 'REC-1')).toBe(false)
    expect(voteFor('recommendation', 'REC-2')).toBeNull()
  })

  it('envoie le vote et le montre aussitôt', async () => {
    useFetchMock.mockReturnValue({ data: ref([]), refresh: vi.fn() })
    const { vote, voteFor } = useFeedback(ref<SiteId>('SITE001'))

    await vote('forecast', '2026-09-29T20:00:00.000Z', true)

    expect(putBodies).toEqual([{ target_type: 'forecast', target_id: '2026-09-29T20:00:00.000Z', useful: true }])
    expect(voteFor('forecast', '2026-09-29T20:00:00.000Z')).toBe(true)
  })
})
