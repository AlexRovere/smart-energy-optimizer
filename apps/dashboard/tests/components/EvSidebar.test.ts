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
const useHealthMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useHealth', () => useHealthMock)

function mockDefaults(role = 'ADMIN', email = 'a.coulon@eni.fr', logout = vi.fn()) {
  useAccountSessionMock.mockReturnValue({
    account: ref({ id: '1', email, role, sites: [] }),
    logout,
  })
  useSitesMock.mockReturnValue({ sites: ref([]) })
  useHealthMock.mockReturnValue({ health: ref(null) })
  useTrainingMock.mockReturnValue({
    pending: ref(false),
    lastTraining: ref(null),
    trigger: vi.fn(),
  })
}

describe('EvSidebar', () => {
  it('affiche l\'email du compte dans le pied de la barre latérale', async () => {
    mockDefaults()
    const wrapper = await mountSuspended(EvSidebar)
    expect(wrapper.text()).toContain('a.coulon@eni.fr')
  })

  it('affiche le label du rôle en français pour ADMIN', async () => {
    mockDefaults('ADMIN')
    const wrapper = await mountSuspended(EvSidebar)
    expect(wrapper.text()).toContain('Administrateur')
  })

  it('affiche le label du rôle en français pour OPERATOR', async () => {
    mockDefaults('OPERATOR', 'marie@eni.fr')
    const wrapper = await mountSuspended(EvSidebar)
    expect(wrapper.text()).toContain('Opérateur')
  })

  it('dérive les initiales depuis l\'email avec point', async () => {
    mockDefaults('ADMIN', 'a.coulon@eni.fr')
    const wrapper = await mountSuspended(EvSidebar)
    const avatar = wrapper.find('[data-testid="user-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.text()).toBe('AC')
  })

  it('dérive les initiales depuis un email sans point dans la partie locale', async () => {
    mockDefaults('ADMIN', 'marie@eni.fr')
    const wrapper = await mountSuspended(EvSidebar)
    const avatar = wrapper.find('[data-testid="user-avatar"]')
    expect(avatar.text()).toBe('MA')
  })

  it('déconnecte le compte depuis le pied de la barre latérale', async () => {
    const logout = vi.fn()
    mockDefaults('VIEWER', 'marie@eni.fr', logout)
    const wrapper = await mountSuspended(EvSidebar)

    await wrapper.find('[aria-label="Se déconnecter"]').trigger('click')

    expect(logout).toHaveBeenCalledOnce()
  })

  it("affiche l'état réel du service et l'heure de la dernière collecte", async () => {
    mockDefaults()
    useHealthMock.mockReturnValue({
      health: ref({ status: 'ok', db: 'ok', parquet: 'ok', version: '1.0.0', uptime: 60, last_data_at: new Date(2026, 8, 29, 14, 0).toISOString() }),
    })
    const wrapper = await mountSuspended(EvSidebar)

    expect(wrapper.text()).toContain('Service opérationnel')
    expect(wrapper.text()).toContain('dernière collecte 29/09 14:00')
    expect(wrapper.text()).not.toContain('polling')
    expect(wrapper.text()).not.toContain('14/09/2026')
  })

  it("signale un historique indisponible quand le Parquet ne se lit plus", async () => {
    mockDefaults()
    useHealthMock.mockReturnValue({
      health: ref({ status: 'degraded', db: 'ok', parquet: 'unavailable', version: 'dev', uptime: 60, last_data_at: null }),
    })
    const wrapper = await mountSuspended(EvSidebar)

    expect(wrapper.text()).toContain('Historique indisponible')
    expect(wrapper.text()).toContain('aucune collecte connue')
  })

  it('signale un service injoignable', async () => {
    mockDefaults()
    useHealthMock.mockReturnValue({
      health: ref({ status: 'down', db: 'unavailable', parquet: 'unavailable', version: '', uptime: 0, last_data_at: null }),
    })
    const wrapper = await mountSuspended(EvSidebar)

    expect(wrapper.text()).toContain('Service indisponible')
  })
})
