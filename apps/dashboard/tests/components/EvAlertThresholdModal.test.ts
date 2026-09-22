// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import EvAlertThresholdModal from '../../app/components/EvAlertThresholdModal.vue'

describe('EvAlertThresholdModal', () => {
  it('ne rend rien quand open est faux', async () => {
    const wrapper = await mountSuspended(EvAlertThresholdModal, {
      props: { open: false, siteName: 'Bureau Paris', type: 'conso', initial: { duration: 5, threshold: 200 } }
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('affiche le site et le type de règle', async () => {
    const wrapper = await mountSuspended(EvAlertThresholdModal, {
      props: { open: true, siteName: 'Bureau Paris', type: 'pic', initial: { duration: 5, threshold: 1.5 } }
    })
    expect(wrapper.text()).toContain('Bureau Paris')
    expect(wrapper.text()).toContain('PIC')
  })

  it('affiche le seuil pic en pourcentage de la moyenne glissante', async () => {
    const wrapper = await mountSuspended(EvAlertThresholdModal, {
      props: { open: true, siteName: 'Bureau Paris', type: 'pic', initial: { duration: 5, threshold: 1.5 } }
    })
    const seuil = wrapper.find('[data-testid="seuil-input"]')
    expect((seuil.element as HTMLInputElement).value).toBe('150')
  })

  it('affiche le seuil conso directement en kWh', async () => {
    const wrapper = await mountSuspended(EvAlertThresholdModal, {
      props: { open: true, siteName: 'Bureau Paris', type: 'conso', initial: { duration: 5, threshold: 200 } }
    })
    const seuil = wrapper.find('[data-testid="seuil-input"]')
    expect((seuil.element as HTMLInputElement).value).toBe('200')
  })

  it('émet save avec le seuil pic reconverti en facteur', async () => {
    const wrapper = await mountSuspended(EvAlertThresholdModal, {
      props: { open: true, siteName: 'Bureau Paris', type: 'pic', initial: { duration: 5, threshold: 1.5 } }
    })
    await wrapper.find('[data-testid="seuil-input"]').setValue('180')
    await wrapper.find('[data-testid="points-input"]').setValue('8')
    await wrapper.find('[data-testid="valider-btn"]').trigger('click')

    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('save')![0]).toEqual([{ duration: 8, threshold: 1.8 }])
  })

  it('émet save avec le seuil conso tel quel', async () => {
    const wrapper = await mountSuspended(EvAlertThresholdModal, {
      props: { open: true, siteName: 'Bureau Paris', type: 'conso', initial: { duration: 5, threshold: 200 } }
    })
    await wrapper.find('[data-testid="seuil-input"]').setValue('250')
    await wrapper.find('[data-testid="valider-btn"]').trigger('click')

    expect(wrapper.emitted('save')![0]).toEqual([{ duration: 5, threshold: 250 }])
  })

  it('émet close au clic sur le fond', async () => {
    const wrapper = await mountSuspended(EvAlertThresholdModal, {
      props: { open: true, siteName: 'Bureau Paris', type: 'conso', initial: { duration: 5, threshold: 200 } }
    })
    await wrapper.find('.fixed').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
