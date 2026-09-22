// @vitest-environment nuxt
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import EvAlertThresholdSettings from '../../app/components/EvAlertThresholdSettings.vue'
import type { AlertThresholdEntry } from '../../shared/alertThresholdSchema'
import type { SiteApiItem } from '../../shared/siteSchema'

const saveMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const useAlertThresholdsMock = vi.hoisted(() => vi.fn())
const useSitesListMock = vi.hoisted(() => vi.fn())

mockNuxtImport('useAlertThresholds', () => useAlertThresholdsMock)
mockNuxtImport('useSitesList', () => useSitesListMock)

const THRESHOLDS: AlertThresholdEntry[] = [
  { site_id: 'SITE002', type: 'pic', duration: 5, threshold: 1.5 },
  { site_id: 'SITE001', type: 'pic', duration: 5, threshold: 1.5 },
  { site_id: 'SITE001', type: 'conso', duration: 12, threshold: 350 }
]

const SITES: SiteApiItem[] = [
  { site_id: 'SITE001', site_name: 'Bureau Paris', site_type: 'office', location: null, capacity_kw: 300, status: 'active', warning_threshold_kw: null, present_in_source: true },
  { site_id: 'SITE002', site_name: 'Usine Lyon', site_type: 'industrial', location: null, capacity_kw: 1000, status: 'active', warning_threshold_kw: null, present_in_source: true }
]

function setup() {
  useAlertThresholdsMock.mockReturnValue({ thresholds: ref(THRESHOLDS), pending: ref(false), error: ref(null), save: saveMock })
  useSitesListMock.mockReturnValue({ sites: ref(SITES), pending: ref(false), error: ref(null) })
}

describe('EvAlertThresholdSettings', () => {
  it('trie les règles par site puis par type', async () => {
    setup()
    const wrapper = await mountSuspended(EvAlertThresholdSettings)

    const lignes = wrapper.findAll('[data-testid="ligne-seuil"]').map(l => l.text())
    expect(lignes[0]).toContain('Bureau Paris')
    expect(lignes[0]).toContain('CONSO')
    expect(lignes[1]).toContain('Bureau Paris')
    expect(lignes[1]).toContain('PIC')
    expect(lignes[2]).toContain('Usine Lyon')
  })

  it('affiche le seuil pic en pourcentage et le seuil conso en kWh', async () => {
    setup()
    const wrapper = await mountSuspended(EvAlertThresholdSettings)

    expect(wrapper.text()).toContain('150 %')
    expect(wrapper.text()).toContain('350 kWh')
  })

  it('ouvrir l\'édition puis valider appelle save avec le site et le type de la ligne', async () => {
    setup()
    const wrapper = await mountSuspended(EvAlertThresholdSettings)

    await wrapper.findAll('[data-testid="editer-btn"]')[0]!.trigger('click')
    await wrapper.find('[data-testid="seuil-input"]').setValue('400')
    await wrapper.find('[data-testid="points-input"]').setValue('10')
    await wrapper.find('[data-testid="valider-btn"]').trigger('click')

    expect(saveMock).toHaveBeenCalledWith('SITE001', 'conso', { duration: 10, threshold: 400 })
  })

  it('referme la modale après enregistrement', async () => {
    setup()
    const wrapper = await mountSuspended(EvAlertThresholdSettings)

    await wrapper.findAll('[data-testid="editer-btn"]')[0]!.trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    await wrapper.find('[data-testid="valider-btn"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})
