export interface DernierResultat {
  statut: 'succès' | 'erreur'
  début: Date
  fin: Date
  message?: string
}

export const trainingState = {
  enCours: false as boolean,
  debut: undefined as Date | undefined,
  dernier: null as DernierResultat | null,
}

export function resetTrainingState(): void {
  trainingState.enCours = false
  trainingState.debut = undefined
  trainingState.dernier = null
}
