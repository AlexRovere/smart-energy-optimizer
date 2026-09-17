// Limitation des tentatives de connexion, critère de #29.
//
// Le compteur vit dans la MÉMOIRE du processus, pas en base. C'est le même
// raisonnement que celui qui écarte Redis dans docs/data.md : il n'y a qu'une
// instance d'applicatif, et rien à partager. Une table coûterait une migration
// et une purge, et offrirait surtout à l'attaquant une écriture en base à
// chaque tentative ratée. Faiblesse assumée : un redémarrage remet les
// compteurs à zéro, et personne d'extérieur ne peut le provoquer.
//
// DEUX clés, pas une. Par adresse seule, un client industriel derrière un NAT
// se verrouillerait tout entier sur l'erreur d'un seul poste. Par compte seul,
// un balayage de comptes depuis une adresse unique passerait inaperçu. Les deux
// compteurs sont vérifiés, et le plus restrictif l'emporte.
export const SEUIL_TENTATIVES = 5
export const FENETRE_MS = 15 * 60_000

export interface Verdict {
  autorise: boolean
  // Zéro quand la tentative est autorisée. Sinon le délai à annoncer dans
  // l'en-tête `Retry-After`, qui se compte en secondes entières.
  retryAfterSecondes: number
}

export interface OptionsLimiteur {
  maintenant?: () => number
}

export function creerLimiteur({ maintenant = Date.now }: OptionsLimiteur = {}) {
  const echecs = new Map<string, number[]>()

  function recents(cle: string): number[] {
    const limite = maintenant() - FENETRE_MS
    return (echecs.get(cle) ?? []).filter(instant => instant > limite)
  }

  return {
    verifier(cles: string[]): Verdict {
      // Le déblocage vient de la sortie de fenêtre de la plus ANCIENNE
      // tentative retenue : c'est elle qui rend un jeton au compteur.
      const attentes = cles
        .map(cle => recents(cle))
        .filter(instants => instants.length >= SEUIL_TENTATIVES)
        .map(instants => Math.min(...instants) + FENETRE_MS - maintenant())

      if (attentes.length === 0) return { autorise: true, retryAfterSecondes: 0 }

      return {
        autorise: false,
        retryAfterSecondes: Math.ceil(Math.max(...attentes) / 1_000)
      }
    },

    enregistrerEchec(cles: string[]): void {
      for (const cle of cles) {
        echecs.set(cle, [...recents(cle), maintenant()])
      }
    },

    reinitialiser(cles: string[]): void {
      for (const cle of cles) {
        echecs.delete(cle)
      }
    }
  }
}
