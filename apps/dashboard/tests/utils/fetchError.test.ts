import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import type { FetchErrorContext } from '../../app/utils/fetchError'
import { watchFetchError } from '../../app/utils/fetchError'

describe('watchFetchError', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loggue sur console.error quand error passe de null à une Error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = ref<Error | null>(null)
    const context: FetchErrorContext = { url: '/api/test', route: () => '/page-test' }

    watchFetchError(error, context)

    error.value = new Error('erreur réseau')
    await nextTick()

    expect(spy).toHaveBeenCalledOnce()
    const [, responseData] = spy.mock.calls[0] as [string, Record<string, unknown>]
    expect(responseData.message).toBe('erreur réseau')
    expect(responseData.route).toBe('/page-test')
    expect(responseData.url).toBe('/api/test')
    expect(typeof responseData.timestamp).toBe('string')
  })

  it('ne loggue pas quand error reste null', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = ref<Error | null>(null)
    const context: FetchErrorContext = { url: '/api/test', route: () => '/' }

    watchFetchError(error, context)
    await nextTick()

    expect(spy).not.toHaveBeenCalled()
  })

  it('ne loggue pas quand error repasse à null après une erreur', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = ref<Error | null>(new Error('première erreur'))
    const context: FetchErrorContext = { url: '/api/test', route: () => '/' }

    watchFetchError(error, context)
    spy.mockClear()

    error.value = null
    await nextTick()

    expect(spy).not.toHaveBeenCalled()
  })

  it('accepte une url sous forme de fonction (évaluation différée)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = ref<Error | null>(null)
    const context: FetchErrorContext = {
      url: () => '/api/sites/SITE001/history',
      route: () => '/sites/SITE001',
    }

    watchFetchError(error, context)

    error.value = new Error('timeout')
    await nextTick()

    expect(spy).toHaveBeenCalledOnce()
    const [, responseData] = spy.mock.calls[0] as [string, Record<string, unknown>]
    expect(responseData.url).toBe('/api/sites/SITE001/history')
    expect(responseData.route).toBe('/sites/SITE001')
  })

  it('n\'inclut pas email ni sessionId dans les logs', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = ref<Error | null>(null)
    const context: FetchErrorContext = { url: '/api/sites', route: () => '/sites' }

    watchFetchError(error, context)

    error.value = new Error('503')
    await nextTick()

    const [, responseData] = spy.mock.calls[0] as [string, Record<string, unknown>]
    expect(responseData).not.toHaveProperty('email')
    expect(responseData).not.toHaveProperty('sessionId')
    expect(responseData).not.toHaveProperty('password')
  })
})
