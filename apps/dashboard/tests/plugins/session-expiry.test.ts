// @vitest-environment nuxt
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigateToMock = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigateToMock)

registerEndpoint('/api/sites/SITE001/current', () => {
  throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
})
registerEndpoint('/api/sites/SITE002/current', () => {
  throw createError({ statusCode: 503, statusMessage: 'Source indisponible' })
})

describe('plugin session expirée', () => {
  beforeEach(() => {
    navigateToMock.mockReset()
    useAccountSession().account.value = { id: '1', email: 'a@b.fr', role: 'ADMIN', sites: [] }
  })

  it("un 401 d'une route d'API renvoie vers la connexion et oublie le compte", async () => {
    await globalThis.$fetch('/api/sites/SITE001/current').catch(() => {})

    expect(navigateToMock).toHaveBeenCalledWith(expect.stringMatching(/^\/login\?expired=1/))
    expect(useAccountSession().account.value).toBeNull()
  })

  it('une autre erreur ne déconnecte pas', async () => {
    await globalThis.$fetch('/api/sites/SITE002/current').catch(() => {})

    expect(navigateToMock).not.toHaveBeenCalled()
    expect(useAccountSession().account.value).not.toBeNull()
  })
})
