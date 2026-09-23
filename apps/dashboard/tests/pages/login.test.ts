// @vitest-environment nuxt
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import LoginPage from '../../app/pages/login.vue'

const useToastMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useToast', () => useToastMock)

const useAccountSessionMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useAccountSession', () => useAccountSessionMock)

describe('page Connexion', () => {
  it('affiche le lien Mot de passe oublié ?', async () => {
    useToastMock.mockReturnValue({ add: vi.fn() })
    useAccountSessionMock.mockReturnValue({ refresh: vi.fn() })
    const wrapper = await mountSuspended(LoginPage)
    expect(wrapper.text()).toContain('Mot de passe oublié ?')
  })

  it('affiche un toast au clic sur Mot de passe oublié ?', async () => {
    const toastAdd = vi.fn()
    useToastMock.mockReturnValue({ add: toastAdd })
    useAccountSessionMock.mockReturnValue({ refresh: vi.fn() })
    const wrapper = await mountSuspended(LoginPage)
    await wrapper.find('[data-testid="mot-de-passe-oublie"]').trigger('click')
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Fonctionnalité non disponible dans cette version',
      color: 'warning',
    }))
  })
})
