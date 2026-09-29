import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { SiteId } from '../../app/types/api'
import type { EnergyReading } from '../../shared/energyReadingSchema'
import { useSiteCurrentReading } from '../../app/composables/useSiteCurrentReading'

const useFetchMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useFetch', () => useFetchMock)
mockNuxtImport('useRoute', () => () => ({ path: '/sites/SITE001' }))

const readingFixture: EnergyReading = {
  timestamp: '2026-09-17T10:00:00Z',
  site_id: 'SITE001',
  site_type: 'office',
  consumption_kw: 82.6,
  consumption_kwh: 82.6,
  voltage_v: 399.0,
  current_a: 119.2,
  power_factor: 0.907,
  temperature_celsius: 25.3,
  humidity_percent: 47.7,
  data_quality: 'good',
  null_reasons: [],
}

describe('useSiteCurrentReading', () => {
  beforeEach(() => {
    useFetchMock.mockReset()
  })

  describe('construction de l\'URL', () => {
    it('appelle useFetch avec /api/sites/SITE001/current', () => {
      const id = ref<SiteId>('SITE001')
      useFetchMock.mockReturnValue({ data: ref(null), pending: ref(true), error: ref(null) })

      useSiteCurrentReading(id)

      expect(useFetchMock).toHaveBeenCalledOnce()
      const urlArg = useFetchMock.mock.calls[0]![0]
      const url = typeof urlArg === 'function' ? urlArg() : urlArg
      expect(url).toBe('/api/sites/SITE001/current')
    })

    it('l\'URL reflète l\'id courant quand il change', () => {
      const id = ref<SiteId>('SITE001')
      useFetchMock.mockReturnValue({ data: ref(null), pending: ref(true), error: ref(null) })

      useSiteCurrentReading(id)

      const urlArg = useFetchMock.mock.calls[0]![0]
      const urlFn = typeof urlArg === 'function' ? urlArg : () => urlArg

      id.value = 'SITE002' as SiteId
      expect(urlFn()).toBe('/api/sites/SITE002/current')
    })

    it('passe watch: [id] à useFetch pour déclencher le rechargement sur changement d\'id', () => {
      const id = ref<SiteId>('SITE001')
      useFetchMock.mockReturnValue({ data: ref(null), pending: ref(true), error: ref(null) })

      useSiteCurrentReading(id)

      const options = useFetchMock.mock.calls[0]![1]
      expect(options?.watch).toEqual([id])
    })
  })

  describe('cas nominal', () => {
    it('retourne data et pending depuis useFetch', () => {
      const id = ref<SiteId>('SITE001')
      useFetchMock.mockReturnValue({
        data: ref(readingFixture),
        pending: ref(false),
        error: ref(null),
      })

      const { data, pending, error } = useSiteCurrentReading(id)

      expect(data.value).toEqual(readingFixture)
      expect(pending.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('data est null et pending est true avant résolution', () => {
      const id = ref<SiteId>('SITE001')
      useFetchMock.mockReturnValue({
        data: ref(null),
        pending: ref(true),
        error: ref(null),
      })

      const { data, pending } = useSiteCurrentReading(id)

      expect(data.value).toBeNull()
      expect(pending.value).toBe(true)
    })
  })

  describe('source indisponible', () => {
    it('expose error quand la source renvoie 503', () => {
      const id = ref<SiteId>('SITE001')
      const err = new Error('Service Unavailable')
      useFetchMock.mockReturnValue({
        data: ref(null),
        pending: ref(false),
        error: ref(err),
      })

      const { data, error } = useSiteCurrentReading(id)

      expect(data.value).toBeNull()
      expect(error.value).toBe(err)
    })

    it('data reste null quand error est défini', () => {
      const id = ref<SiteId>('SITE001')
      useFetchMock.mockReturnValue({
        data: ref(null),
        pending: ref(false),
        error: ref(new Error('503')),
      })

      const { data } = useSiteCurrentReading(id)

      expect(data.value).toBeNull()
    })
  })

  describe('journalisation des erreurs', () => {
    afterEach(() => vi.restoreAllMocks())

    it('loggue sur console.error quand error passe de null à une Error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const id = ref<SiteId>('SITE001')
      const errorRef = ref<Error | null>(null)
      useFetchMock.mockReturnValue({ data: ref(null), pending: ref(false), error: errorRef })

      useSiteCurrentReading(id)

      errorRef.value = new Error('503 Lecture courante indisponible')
      await nextTick()

      expect(consoleSpy).toHaveBeenCalledOnce()
      const [, responseData] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>]
      expect(responseData.message).toBe('503 Lecture courante indisponible')
    })
  })
})
