import { defineEventHandler } from 'h3'
import { requireRole } from '../utils/guard'
import { trainingState } from '../utils/trainingState'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  const { inProgress, lastRun } = trainingState
  return {
    in_progress: inProgress,
    last: lastRun
      ? {
          status: lastRun.status,
          started_at: lastRun.startedAt.toISOString(),
          finished_at: lastRun.finishedAt.toISOString(),
          message: lastRun.message,
        }
      : null,
  }
})
