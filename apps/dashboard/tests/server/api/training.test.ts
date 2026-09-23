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

const compteAdmin = { id: 'user-uuid', email: 'admin@enervision.fr', role: 'ADMIN' }
const mockEvent = { path: '/api/training' } as H3Event

describe('POST /api/training', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTrainingState()
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

  it('retourne 409 si un entraînement est déjà en cours', async () => {
    trainingState.enCours = true

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 409 })
    expect(mockTriggerTraining).not.toHaveBeenCalled()
  })

  it('passe enCours à true immédiatement après le déclenchement', async () => {
    let enCoursAuMomentDuLancement = false
    mockTriggerTraining.mockImplementation(async () => {
      enCoursAuMomentDuLancement = trainingState.enCours
      return { status: 'ok' }
    })

    await handler(mockEvent)

    expect(enCoursAuMomentDuLancement).toBe(true)
  })

  it('met à jour dernier.statut à succès après un entraînement réussi', async () => {
    const résolution = Promise.resolve({ status: 'ok' })
    mockTriggerTraining.mockReturnValue(résolution)

    await handler(mockEvent)
    await résolution
    // .then et .finally sont programmés en microtasks : deux ticks supplémentaires
    await Promise.resolve()
    await Promise.resolve()

    expect(trainingState.dernier?.statut).toBe('succès')
    expect(trainingState.enCours).toBe(false)
  })

  it('met à jour dernier.statut à erreur après un échec ML', async () => {
    const erreur = Object.assign(new Error('422 Données invalides'), { statusCode: 422, data: { message: 'Données invalides' } })
    const rejet = Promise.reject(erreur)
    mockTriggerTraining.mockReturnValue(rejet)

    await handler(mockEvent)
    await rejet.catch(() => {})

    expect(trainingState.dernier?.statut).toBe('erreur')
    expect(trainingState.enCours).toBe(false)
  })
})
