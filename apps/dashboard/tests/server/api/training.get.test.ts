import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../server/api/training.get'
import { trainingState, resetTrainingState } from '../../../server/utils/trainingState'

vi.hoisted(() => {
  ;(globalThis as Record<string, unknown>).defineEventHandler = (fn: unknown) => fn
})

const { mockRequireRole } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
}))

vi.mock('../../../server/utils/guard', () => ({
  requireRole: mockRequireRole,
}))

const adminAccount = { id: 'user-uuid', email: 'admin@enervision.fr', role: 'ADMIN' }
const mockEvent = { path: '/api/training' } as H3Event

describe('GET /api/training', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTrainingState()
    mockRequireRole.mockResolvedValue(adminAccount)
  })

  it('retourne 403 si le compte n\'est pas ADMIN', async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error('Accès interdit'), { statusCode: 403 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('retourne in_progress false et last null à l\'état initial', async () => {
    const result = await handler(mockEvent)

    expect(result).toEqual({ in_progress: false, last: null })
  })

  it('retourne in_progress true pendant un entraînement', async () => {
    trainingState.inProgress = true

    const result = await handler(mockEvent)

    expect(result.in_progress).toBe(true)
  })

  it('retourne le statut succès après un entraînement réussi', async () => {
    const startedAt = new Date('2026-09-23T10:00:00Z')
    const finishedAt = new Date('2026-09-23T10:02:00Z')
    trainingState.lastRun = { status: 'success', startedAt, finishedAt }

    const result = await handler(mockEvent)

    expect(result.last?.status).toBe('success')
    expect(result.last?.started_at).toBe(startedAt.toISOString())
    expect(result.last?.finished_at).toBe(finishedAt.toISOString())
  })

  it('retourne le statut erreur avec le message après un échec', async () => {
    const startedAt = new Date('2026-09-23T10:00:00Z')
    const finishedAt = new Date('2026-09-23T10:00:05Z')
    trainingState.lastRun = { status: 'error', startedAt, finishedAt, message: 'Données invalides' }

    const result = await handler(mockEvent)

    expect(result.last?.status).toBe('error')
    expect(result.last?.message).toBe('Données invalides')
  })
})
