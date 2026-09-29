// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import EvSitesTable from '../../app/components/EvSitesTable.vue'
import type { SiteSummary } from '../../app/types/api'

const SITE = {
  site_id: 'SITE001',
  site_name: 'Bureau Paris',
  site_type: 'office',
  current_consumption_kw: 87.34,
  capacity_kw: 1200,
  load_percent: 7.3,
  data_quality: 'partial',
  health: 'degraded',
  last_data_at: new Date(2026, 8, 29, 13, 0).toISOString(),
} as SiteSummary

describe('EvSitesTable', () => {
  it('affiche consommation et capacité avec leur unité', async () => {
    const wrapper = await mountSuspended(EvSitesTable, { props: { sites: [SITE] } })
    const text = wrapper.text().replace(/\s/g, ' ')

    expect(text).toContain('87,34 kW')
    expect(text).toContain('1 200 kW')
  })

  it('traduit le type de site et le niveau de qualité', async () => {
    const wrapper = await mountSuspended(EvSitesTable, { props: { sites: [SITE] } })

    expect(wrapper.text()).toContain('Bureaux')
    expect(wrapper.text()).toContain('Partielle')
    expect(wrapper.text()).not.toContain('partial')
  })

  it('ouvre le site au clic et au clavier quand la ligne est cliquable', async () => {
    const wrapper = await mountSuspended(EvSitesTable, { props: { sites: [SITE], clickable: true } })
    const row = wrapper.find('tbody tr')

    await row.trigger('click')
    await row.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('select')).toHaveLength(2)
    expect(row.attributes('tabindex')).toBe('0')
  })

  it('donne la date de la dernière donnée reçue pour chaque site', async () => {
    const wrapper = await mountSuspended(EvSitesTable, { props: { sites: [SITE, { ...SITE, site_id: 'SITE002', last_data_at: null }] } })
    const rows = wrapper.findAll('tbody tr')

    expect(rows[0]!.text()).toContain('29/09 13:00')
    expect(rows[1]!.text()).toContain('aucune')
  })

  it('affiche la santé en français', async () => {
    const wrapper = await mountSuspended(EvSitesTable, { props: { sites: [SITE] } })

    expect(wrapper.text()).toContain('Dégradé')
    expect(wrapper.text()).not.toContain('degraded')
  })
})
