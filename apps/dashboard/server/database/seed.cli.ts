// Seul endroit qui lit l'environnement et ouvre une connexion : `amorcer` reste
// une fonction pure de ce point de vue, donc appelable deux fois par un test.
import postgres from 'postgres'
import { amorcer } from './seed'

function requis(nom: string): string {
  const valeur = process.env[nom]
  if (!valeur) {
    // Pas de valeur par défaut, et surtout pas pour un mot de passe : un défaut
    // deviné finit par tourner en production sans que personne ne l'ait voulu.
    throw new Error(`${nom} n'est pas renseignée. Voir .env.example.`)
  }
  return valeur
}

const sql = postgres(requis('NUXT_DATABASE_URL'), { max: 1 })

try {
  const resultat = await amorcer(sql, {
    motDePasseDemonstration: requis('SEED_PASSWORD'),
    motDePasseEtl: requis('ETL_DB_PASSWORD')
  })
  console.info(
    `Amorçage terminé : ${resultat.rolesCrees} rôle(s), ${resultat.comptesCrees} compte(s), ${resultat.sitesCrees} site(s) et ${resultat.accèsCrees} accès créés.`
  )
} finally {
  await sql.end()
}
