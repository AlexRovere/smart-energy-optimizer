import { ref } from 'vue'

export interface DernierEntrainement {
  statut: 'succès' | 'erreur'
  à: Date
}

export function useTraining() {
  const pending = ref(false)
  const dernierEntrainement = ref<DernierEntrainement | null>(null)

  async function déclencher() {
    pending.value = true
    try {
      await $fetch('/api/training', { method: 'POST' })
      dernierEntrainement.value = { statut: 'succès', à: new Date() }
    } catch {
      dernierEntrainement.value = { statut: 'erreur', à: new Date() }
    } finally {
      pending.value = false
    }
  }

  return { pending, dernierEntrainement, déclencher }
}
