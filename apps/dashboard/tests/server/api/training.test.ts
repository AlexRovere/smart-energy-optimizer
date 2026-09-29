import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../server/api/training.post'
import { trainingState, resetTrainingState } from '../../../server/utils/trainingState'

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

const adminAccount = { id: 'user-uuid', email: 'admin@enervision.fr', role: 'ADMIN' }
const mockEvent = { path: '/api/training' } as H3Event

describe('POST /api/training', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTrainingState()
    mockRequireRole.mockResolvedValue(adminAccount)
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

  it('répond immédiatement avec { status: "started" }', async () => {
    // Simule un appel ML long en ne résolvant jamais
    mockTriggerTraining.mockReturnValue(new Promise(() => {}))

    const result = await handler(mockEvent)

    expect(result).toEqual({ status: 'started' })
  })

  it('retourne { status: "started" } même si le service ML échoue', async () => {
    mockTriggerTraining.mockRejectedValue(new Error('connect ECONNREFUSED'))

    const result = await handler(mockEvent)

    expect(result).toEqual({ status: 'started' })
  })

  it('journalise l\'erreur si le service ML échoue (après retour)', async () => {
    const rejection = Promise.reject(new Error('timeout'))
    mockTriggerTraining.mockReturnValue(rejection)

    await handler(mockEvent)
    // Laisser la promesse rejetée se propager
    await rejection.catch(() => {})

    expect(mockLoggerError).toHaveBeenCalledOnce()
  })

  it('retourne 409 si un entraînement est déjà en cours', async () => {
    trainingState.inProgress = true

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 409 })
    expect(mockTriggerTraining).not.toHaveBeenCalled()
  })

  it('passe enCours à true immédiatement après le déclenchement', async () => {
    let inProgressAtLaunch = false
    mockTriggerTraining.mockImplementation(async () => {
      inProgressAtLaunch = trainingState.inProgress
      return { status: 'ok' }
    })

    await handler(mockEvent)

    expect(inProgressAtLaunch).toBe(true)
  })

  it('met à jour lastRun.status à success après un entraînement réussi', async () => {
    const resolution = Promise.resolve({ status: 'ok' })
    mockTriggerTraining.mockReturnValue(resolution)

    await handler(mockEvent)
    await resolution
    // .then et .finally sont programmés en microtasks : deux ticks supplémentaires
    await Promise.resolve()
    await Promise.resolve()

    expect(trainingState.lastRun?.status).toBe('success')
    expect(trainingState.inProgress).toBe(false)
  })

  it('met à jour lastRun.status à error après un échec ML', async () => {
    const error = Object.assign(new Error('422 Données invalides'), { statusCode: 422, data: { message: 'Données invalides' } })
    const rejection = Promise.reject(error)
    mockTriggerTraining.mockReturnValue(rejection)

    await handler(mockEvent)
    await rejection.catch(() => {})

    expect(trainingState.lastRun?.status).toBe('error')
    expect(trainingState.inProgress).toBe(false)
  })
})
