import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../server/api/training.post'

vi.hoisted(() => {
  ;(globalThis as Record<string, unknown>).defineEventHandler = (fn: unknown) => fn
})


const {
  mockRequireRole,
  mockTriggerTraining,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockTriggerTraining: vi.fn(),
  mockLoggerError: vi.fn(),
}))

vi.mock('../../../server/utils/guard', () => ({
  requireRole: mockRequireRole,
}))

vi.mock('../../../server/utils/mlClient', () => ({
  triggerTraining: mockTriggerTraining,
}))

vi.mock('../../../server/utils/logger', () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const compteAdmin = { id: 'user-uuid', email: 'admin@enervision.fr', role: 'ADMIN' }
const mockEvent = { path: '/api/training' } as H3Event

describe('POST /api/training', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireRole.mockResolvedValue(compteAdmin)
    mockTriggerTraining.mockResolvedValue({ model_version: 4, training_rows: 1000, sites: 7, training_start: '2026-09-23T10:00:00Z', training_end: '2026-09-23T10:02:00Z' })
  })

  it('retourne 401 quand requireRole rejette avec 401', async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error('Session invalide'), { statusCode: 401 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('retourne 403 quand le compte n\'est pas ADMIN', async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error('Accès interdit'), { statusCode: 403 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('vérifie le rôle ADMIN', async () => {
    await handler(mockEvent)

    expect(mockRequireRole).toHaveBeenCalledWith(mockEvent, 'ADMIN')
  })

  it('déclenche triggerTraining sans attendre la réponse', async () => {
    await handler(mockEvent)

    expect(mockTriggerTraining).toHaveBeenCalledOnce()
  })

  it('répond immédiatement avec { status: "démarré" }', async () => {
    // Simule un appel ML long en ne résolvant jamais
    mockTriggerTraining.mockReturnValue(new Promise(() => {}))

    const résultat = await handler(mockEvent)

    expect(résultat).toEqual({ status: 'démarré' })
  })

  it('retourne { status: "démarré" } même si le service ML échoue', async () => {
    mockTriggerTraining.mockRejectedValue(new Error('connect ECONNREFUSED'))

    const résultat = await handler(mockEvent)

    expect(résultat).toEqual({ status: 'démarré' })
  })

  it('journalise l\'erreur si le service ML échoue (après retour)', async () => {
    const rejet = Promise.reject(new Error('timeout'))
    mockTriggerTraining.mockReturnValue(rejet)

    await handler(mockEvent)
    // Laisser la promesse rejetée se propager
    await rejet.catch(() => {})

    expect(mockLoggerError).toHaveBeenCalledOnce()
  })
})
