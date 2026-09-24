// @vitest-environment nuxt
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import EvCorrectionAction from '../../app/components/EvCorrectionAction.vue'
import type { Recommendation } from '../../app/types/api'

const useToastMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useToast', () => useToastMock)

const mockRec: Recommendation = {
  recommendation_id: 'REC-SITE001-1',
  site_id: 'SITE001',
  source: 'forecast',
  type: 'scheduling',
  priority: 'high',
  title: 'Décaler la relance CVC de 45 min',
  description: 'fenêtre 14:30 → 15:15 · confiance haute',
  trigger: { timestamp: '2026-09-16T14:00:00Z', value_kw: 98, threshold_kw: 240 },
  estimated_saving_kwh: 12,
  gain_kw: -17,
  confidence: 0.88,
  window: '14:30 → 15:15',
}

describe('EvCorrectionAction', () => {
  it.each([
    ['le titre de la recommandation', ['Décaler la relance CVC de 45 min']],
    ['la description (fenêtre + confiance)', ['fenêtre 14:30 → 15:15 · confiance haute']],
    ['le gain en kW', ['-17', 'kW']],
    ['le score de confiance', ['0,88']],
  ])('affiche %s', async (_description, textesAttendus) => {
    const wrapper = await mountSuspended(EvCorrectionAction, { props: { recommendation: mockRec } })
    for (const texteAttendu of textesAttendus) {
      expect(wrapper.text()).toContain(texteAttendu)
    }
  })

  it('affiche le bouton Appliquer', async () => {
    const wrapper = await mountSuspended(EvCorrectionAction, { props: { recommendation: mockRec } })
    expect(wrapper.text()).toContain(texteAttendu)
  })

  it('affiche un toast au clic sur Appliquer', async () => {
    const toastAdd = vi.fn()
    useToastMock.mockReturnValue({ add: toastAdd })
    const wrapper = await mountSuspended(EvCorrectionAction, { props: { recommendation: mockRec } })
    await wrapper.find('[data-testid="apply-btn"]').trigger('click')
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Fonctionnalité non disponible dans cette version',
      color: 'warning',
    }))
  })
})
