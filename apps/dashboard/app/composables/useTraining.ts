import { ref } from 'vue'

export interface DernierEntrainement {
  statut: 'succès' | 'erreur'
  à: Date
  message?: string
}

interface StatutEntrainement {
  en_cours: boolean
  dernier: {
    statut: 'succès' | 'erreur'
    début: string
    fin: string
    message?: string
  } | null
}

export function useTraining() {
  const pending = ref(false)
  const dernierEntrainement = ref<DernierEntrainement | null>(null)

  async function rafraichir() {
    const état = await $fetch<StatutEntrainement>('/api/training')
    pending.value = état.en_cours
    if (!état.en_cours && état.dernier) {
      dernierEntrainement.value = {
        statut: état.dernier.statut,
        à: new Date(état.dernier.fin),
        message: état.dernier.message,
      }
    }
  }

  async function déclencher() {
    await $fetch('/api/training', { method: 'POST' })
    pending.value = true
    const intervalId = setInterval(async () => {
      await rafraichir()
      if (!pending.value) clearInterval(intervalId)
    }, 3000)
  }

  return { pending, dernierEntrainement, déclencher, rafraichir }
}
