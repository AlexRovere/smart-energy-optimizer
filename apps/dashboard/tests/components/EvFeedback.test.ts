// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import EvFeedback from '../../app/components/EvFeedback.vue'

type Wrapper = Awaited<ReturnType<typeof mountSuspended<typeof EvFeedback>>>

function button(wrapper: Wrapper, label: string) {
  return wrapper.findAll('button').find(candidate => candidate.text() === label)!
}

describe('EvFeedback', () => {
  it('propose les deux avis, aucun choisi au départ', async () => {
    const wrapper = await mountSuspended(EvFeedback, { props: { current: null } })

    expect(button(wrapper, 'Utile').attributes('aria-pressed')).toBe('false')
    expect(button(wrapper, 'Pas utile').attributes('aria-pressed')).toBe('false')
  })

  it("marque l'avis déjà donné", async () => {
    const wrapper = await mountSuspended(EvFeedback, { props: { current: false } })

    expect(button(wrapper, 'Pas utile').attributes('aria-pressed')).toBe('true')
    expect(button(wrapper, 'Utile').attributes('aria-pressed')).toBe('false')
  })

  it('émet le vote choisi', async () => {
    const wrapper = await mountSuspended(EvFeedback, { props: { current: null } })

    await button(wrapper, 'Utile').trigger('click')
    await button(wrapper, 'Pas utile').trigger('click')

    expect(wrapper.emitted('vote')).toEqual([[true], [false]])
  })
})
