// @vitest-environment nuxt
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import EvSidebar from '../../app/components/EvSidebar.vue'

const useAccountSessionMock = vi.hoisted(() => vi.fn())
const useSitesMock = vi.hoisted(() => vi.fn())
const useTrainingMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useAccountSession', () => useAccountSessionMock)
mockNuxtImport('useSites', () => useSitesMock)
mockNuxtImport('useTraining', () => useTrainingMock)

function mockDefauts(role = 'ADMIN', email = 'a.coulon@eni.fr') {
  useAccountSessionMock.mockReturnValue({
    account: ref({ id: '1', email, role, sites: [] }),
    logout: vi.fn(),
  })
  useSitesMock.mockReturnValue({ sites: ref([]) })
  useTrainingMock.mockReturnValue({
    pending: ref(false),
    dernierEntrainement: ref(null),
    déclencher: vi.fn(),
  })
}

describe('EvSidebar', () => {
  it('affiche l\'email du compte dans le pied de la barre latérale', async () => {
    mockDefauts()
    const wrapper = await mountSuspended(EvSidebar)
    expect(wrapper.text()).toContain('a.coulon@eni.fr')
  })

  it('affiche le label du rôle en français pour ADMIN', async () => {
    mockDefauts('ADMIN')
    const wrapper = await mountSuspended(EvSidebar)
    expect(wrapper.text()).toContain('Administrateur')
  })

  it('affiche le label du rôle en français pour OPERATOR', async () => {
    mockDefauts('OPERATOR', 'marie@eni.fr')
    const wrapper = await mountSuspended(EvSidebar)
    expect(wrapper.text()).toContain('Opérateur')
  })

  it('dérive les initiales depuis l\'email avec point', async () => {
    mockDefauts('ADMIN', 'a.coulon@eni.fr')
    const wrapper = await mountSuspended(EvSidebar)
    const avatar = wrapper.find('[data-testid="user-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.text()).toBe('AC')
  })

  it('dérive les initiales depuis un email sans point dans la partie locale', async () => {
    mockDefauts('ADMIN', 'marie@eni.fr')
    const wrapper = await mountSuspended(EvSidebar)
    const avatar = wrapper.find('[data-testid="user-avatar"]')
    expect(avatar.text()).toBe('MA')
  })
})
