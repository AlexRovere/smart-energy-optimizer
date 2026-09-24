// @vitest-environment nuxt
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import EvAlertCard from '../../app/components/EvAlertCard.vue'
import type { Alert } from '../../app/types/api'

const useToastMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useToast', () => useToastMock)

const alerte: Alert = {
  alert_id: 'ALERT-001',
  site_id: 'SITE001',
  severity: 'high',
  type: 'threshold',
  message: 'Consommation excessive détectée',
  timestamp: '2026-09-23T10:00:00Z',
  value: 320,
  threshold: 300,
}

describe('EvAlertCard', () => {
  it('affiche le message de l\'alerte', async () => {
    useToastMock.mockReturnValue({ add: vi.fn() })
    const wrapper = await mountSuspended(EvAlertCard, { props: { alert: alerte } })
    expect(wrapper.text()).toContain('Consommation excessive détectée')
  })

  it('affiche le bouton Acquitter', async () => {
    useToastMock.mockReturnValue({ add: vi.fn() })
    const wrapper = await mountSuspended(EvAlertCard, { props: { alert: alerte } })
    expect(wrapper.text()).toContain('Acquitter')
  })

  it('affiche un toast au clic sur Acquitter', async () => {
    const toastAdd = vi.fn()
    useToastMock.mockReturnValue({ add: toastAdd })
    const wrapper = await mountSuspended(EvAlertCard, { props: { alert: alerte } })
    await wrapper.find('[data-testid="acquitter-btn"]').trigger('click')
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Fonctionnalité non disponible dans cette version',
      color: 'warning',
    }))
  })
})
