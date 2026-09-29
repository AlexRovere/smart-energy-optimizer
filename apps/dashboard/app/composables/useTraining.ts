import { ref } from 'vue'

export interface LastTraining {
  status: 'success' | 'error'
  finishedAt: Date
  message?: string
}

// Réponse de GET /api/training (docs/api.md).
interface TrainingStatus {
  in_progress: boolean
  last: {
    status: 'success' | 'error'
    started_at: string
    finished_at: string
    message?: string
  } | null
}

export function useTraining() {
  const pending = ref(false)
  const lastTraining = ref<LastTraining | null>(null)

  async function reload() {
    const state = await $fetch<TrainingStatus>('/api/training')
    pending.value = state.in_progress
    if (!state.in_progress && state.last) {
      lastTraining.value = {
        status: state.last.status,
        finishedAt: new Date(state.last.finished_at),
        message: state.last.message,
      }
    }
  }

  async function trigger() {
    await $fetch('/api/training', { method: 'POST' })
    pending.value = true
    const intervalId = setInterval(async () => {
      await reload()
      if (!pending.value) clearInterval(intervalId)
    }, 3000)
  }

  return { pending, lastTraining, trigger, reload }
}
