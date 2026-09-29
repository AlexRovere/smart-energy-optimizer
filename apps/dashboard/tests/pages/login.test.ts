// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '../../app/pages/login.vue'

const navigateToMock = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigateToMock)

registerEndpoint('/api/auth/login', { method: 'POST', handler: () => ({ success: true }) })
registerEndpoint('/api/auth/session', () => ({ user: { id: '1', email: 'a@b.fr', role: 'ADMIN', sites: [] } }))

async function signIn(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  await wrapper.find('input[type="email"]').setValue('a@b.fr')
  await wrapper.find('input[type="password"]').setValue('un-mot-de-passe')
  await wrapper.find('form').trigger('submit')
  await vi.waitFor(() => expect(navigateToMock).toHaveBeenCalled())
}

describe('page Connexion', () => {
  beforeEach(() => navigateToMock.mockReset())

  it('explique une déconnexion due à une session expirée', async () => {
    const wrapper = await mountSuspended(LoginPage, { route: '/login?expired=1' })
    expect(wrapper.text()).toContain('Session expirée, reconnectez-vous')
  })

  it("n'affiche aucun message à une connexion ordinaire", async () => {
    const wrapper = await mountSuspended(LoginPage, { route: '/login' })
    expect(wrapper.text()).not.toContain('Session expirée')
  })

  it('ramène sur la page consultée avant expiration', async () => {
    const wrapper = await mountSuspended(LoginPage, { route: '/login?expired=1&redirect=%2Fsites%2FSITE001' })
    await signIn(wrapper)
    expect(navigateToMock).toHaveBeenCalledWith('/sites/SITE001')
  })

  it('ne suit pas une adresse de retour externe', async () => {
    const wrapper = await mountSuspended(LoginPage, { route: '/login?redirect=https%3A%2F%2Failleurs.example' })
    await signIn(wrapper)
    expect(navigateToMock).toHaveBeenCalledWith('/')
  })
})
