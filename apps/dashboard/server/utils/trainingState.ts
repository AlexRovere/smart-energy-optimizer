export interface TrainingRun {
  status: 'success' | 'error'
  startedAt: Date
  finishedAt: Date
  message?: string
}

export const trainingState = {
  inProgress: false as boolean,
  startedAt: undefined as Date | undefined,
  lastRun: null as TrainingRun | null,
}

export function resetTrainingState(): void {
  trainingState.inProgress = false
  trainingState.startedAt = undefined
  trainingState.lastRun = null
}
