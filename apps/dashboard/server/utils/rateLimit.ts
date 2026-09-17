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
export const MAX_ATTEMPTS = 5
export const WINDOW_MS = 15 * 60_000

export interface Verdict {
  allowed: boolean
  // Zéro quand la tentative est autorisée. Sinon le délai à annoncer dans
  // l'en-tête `Retry-After`, qui se compte en secondes entières.
  retryAfterSeconds: number
}

export interface RateLimiterOptions {
  now?: () => number
}

export function createRateLimiter({ now = Date.now }: RateLimiterOptions = {}) {
  const failures = new Map<string, number[]>()

  function recent(key: string): number[] {
    const cutoff = now() - WINDOW_MS
    return (failures.get(key) ?? []).filter(stamp => stamp > cutoff)
  }

  return {
    check(keys: string[]): Verdict {
      // Le déblocage vient de la sortie de fenêtre de la plus ANCIENNE
      // tentative retenue : c'est elle qui rend un jeton au compteur.
      const waits = keys
        .map(key => recent(key))
        .filter(stamps => stamps.length >= MAX_ATTEMPTS)
        .map(stamps => Math.min(...stamps) + WINDOW_MS - now())

      if (waits.length === 0) return { allowed: true, retryAfterSeconds: 0 }

      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(Math.max(...waits) / 1_000)
      }
    },

    recordFailure(keys: string[]): void {
      for (const key of keys) {
        failures.set(key, [...recent(key), now()])
      }
    },

    reset(keys: string[]): void {
      for (const key of keys) {
        failures.delete(key)
      }
    }
  }
}

// L'instance que partagent les requêtes. Elle vit aussi longtemps que le
// processus, et pas une seconde de plus : c'est la faiblesse assumée plus haut.
export const loginRateLimiter = createRateLimiter()

export function attemptKeys(ip: string, email: string): string[] {
  // L'adresse est préfixée pour qu'une adresse ne puisse jamais collisionner
  // avec une adresse électronique, et l'email est normalisé en minuscules :
  // sinon il suffirait d'alterner la casse pour se donner un quota neuf.
  return [`ip:${ip}`, `account:${email.toLowerCase()}`]
}
