// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import EvTrainingButton from '../../app/components/EvTrainingButton.vue'

describe('EvTrainingButton', () => {
  it('affiche le bouton de déclenchement', async () => {
    const wrapper = await mountSuspended(EvTrainingButton)
    expect(wrapper.text()).toContain('Entraîner le modèle')
  })

  it('n\'affiche pas de badge quand aucun entraînement n\'a été lancé', async () => {
    const wrapper = await mountSuspended(EvTrainingButton)
    expect(wrapper.find('[data-testid="training-badge"]').exists()).toBe(false)
  })

  it('affiche un badge succès après un entraînement réussi', async () => {
    const wrapper = await mountSuspended(EvTrainingButton, {
      props: {
        dernierEntrainement: { statut: 'succès', à: new Date('2026-09-23T10:32:00Z') }
      }
    })
    const badge = wrapper.find('[data-testid="training-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('Succès')
  })

  it('affiche un badge erreur après un entraînement échoué', async () => {
    const wrapper = await mountSuspended(EvTrainingButton, {
      props: {
        dernierEntrainement: { statut: 'erreur', à: new Date('2026-09-23T10:32:00Z') }
      }
    })
    const badge = wrapper.find('[data-testid="training-badge"]')
    expect(badge.text()).toContain('Erreur')
  })

  it('affiche l\'heure du dernier entraînement dans le badge', async () => {
    const wrapper = await mountSuspended(EvTrainingButton, {
      props: {
        dernierEntrainement: { statut: 'succès', à: new Date('2026-09-23T10:32:00Z') }
      }
    })
    const badge = wrapper.find('[data-testid="training-badge"]')
    expect(badge.text()).toMatch(/\d{2}:\d{2}/)
  })

  it('le bouton porte data-testid="training-trigger"', async () => {
    const wrapper = await mountSuspended(EvTrainingButton)
    expect(wrapper.find('[data-testid="training-trigger"]').exists()).toBe(true)
  })

  it('affiche un badge « En cours » quand loading est true', async () => {
    const wrapper = await mountSuspended(EvTrainingButton, {
      props: { loading: true }
    })
    const badge = wrapper.find('[data-testid="training-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('En cours')
  })

  it('n\'affiche pas l\'heure dans le badge « En cours »', async () => {
    const wrapper = await mountSuspended(EvTrainingButton, {
      props: { loading: true }
    })
    const badge = wrapper.find('[data-testid="training-badge"]')
    expect(badge.text()).not.toMatch(/\d{2}:\d{2}/)
  })

  it('affiche le badge succès et non « En cours » quand loading est false', async () => {
    const wrapper = await mountSuspended(EvTrainingButton, {
      props: {
        loading: false,
        dernierEntrainement: { statut: 'succès', à: new Date('2026-09-23T10:32:00Z') }
      }
    })
    const badge = wrapper.find('[data-testid="training-badge"]')
    expect(badge.text()).toContain('Succès')
    expect(badge.text()).not.toContain('En cours')
  })
})
