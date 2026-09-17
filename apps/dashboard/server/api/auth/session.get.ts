import { db } from '../../database'
import { exigerCompte } from '../../utils/garde'
import { sitesAutorises } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const compte = await exigerCompte(event)

  // `sites` fait partie du contrat d'api.md. Il sort vide tant que l'ETL n'a
  // pas posé le référentiel (#21) et qu'aucun périmètre n'est réglé, ce qui est
  // le bon défaut : zéro accès plutôt que tous.
  return { user: { ...compte, sites: await sitesAutorises(db, compte.id) } }
})
