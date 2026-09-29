// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import EvModal from '../../app/components/EvModal.vue'

// happy-dom ne calcule aucune mise en page : on vérifie les classes qui portent
// le centrage. Le preflight de Tailwind remet la marge à 0 et annule le
// margin: auto que le navigateur donne à un <dialog> modal (#63).
describe('EvModal', () => {
  it('rétablit le centrage natif du dialogue', async () => {
    const wrapper = await mountSuspended(EvModal, { props: { open: true } })
    expect(wrapper.find('dialog').classes()).toContain('m-auto')
  })

  it('fait défiler un contenu plus haut que l’écran au lieu de déborder', async () => {
    const wrapper = await mountSuspended(EvModal, { props: { open: true } })
    const classes = wrapper.find('dialog').classes()
    expect(classes).toContain('max-h-[85vh]')
    expect(classes).toContain('overflow-y-auto')
  })
})
