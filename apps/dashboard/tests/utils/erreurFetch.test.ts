import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import type { ContexteErreurFetch } from '../../app/utils/erreurFetch'
import { observerErreurFetch } from '../../app/utils/erreurFetch'

describe('observerErreurFetch', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loggue sur console.error quand error passe de null à une Error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = ref<Error | null>(null)
    const contexte: ContexteErreurFetch = { url: '/api/test', route: () => '/page-test' }

    observerErreurFetch(error, contexte)

    error.value = new Error('erreur réseau')
    await nextTick()

    expect(spy).toHaveBeenCalledOnce()
    const [, données] = spy.mock.calls[0] as [string, Record<string, unknown>]
    expect(données.message).toBe('erreur réseau')
    expect(données.route).toBe('/page-test')
    expect(données.url).toBe('/api/test')
    expect(typeof données.timestamp).toBe('string')
  })

  it('ne loggue pas quand error reste null', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = ref<Error | null>(null)
    const contexte: ContexteErreurFetch = { url: '/api/test', route: () => '/' }

    observerErreurFetch(error, contexte)
    await nextTick()

    expect(spy).not.toHaveBeenCalled()
  })

  it('ne loggue pas quand error repasse à null après une erreur', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = ref<Error | null>(new Error('première erreur'))
    const contexte: ContexteErreurFetch = { url: '/api/test', route: () => '/' }

    observerErreurFetch(error, contexte)
    spy.mockClear()

    error.value = null
    await nextTick()

    expect(spy).not.toHaveBeenCalled()
  })

  it('accepte une url sous forme de fonction (évaluation différée)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = ref<Error | null>(null)
    const contexte: ContexteErreurFetch = {
      url: () => '/api/sites/SITE001/history',
      route: () => '/sites/SITE001',
    }

    observerErreurFetch(error, contexte)

    error.value = new Error('timeout')
    await nextTick()

    expect(spy).toHaveBeenCalledOnce()
    const [, données] = spy.mock.calls[0] as [string, Record<string, unknown>]
    expect(données.url).toBe('/api/sites/SITE001/history')
    expect(données.route).toBe('/sites/SITE001')
  })

  it('n\'inclut pas email ni sessionId dans les logs', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = ref<Error | null>(null)
    const contexte: ContexteErreurFetch = { url: '/api/sites', route: () => '/sites' }

    observerErreurFetch(error, contexte)

    error.value = new Error('503')
    await nextTick()

    const [, données] = spy.mock.calls[0] as [string, Record<string, unknown>]
    expect(données).not.toHaveProperty('email')
    expect(données).not.toHaveProperty('sessionId')
    expect(données).not.toHaveProperty('password')
  })
})
