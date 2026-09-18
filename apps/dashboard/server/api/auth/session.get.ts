import { db } from '../../database'
import { requireAccount } from '../../utils/guard'
import { allowedSites } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)

  // `sites` fait partie du contrat d'api.md. Il sort vide tant que l'ETL n'a
  // pas posé le référentiel (#21) et qu'aucun périmètre n'est réglé, ce qui est
  // le bon défaut : zéro accès plutôt que tous.
  return { user: { ...account, sites: await allowedSites(db, account) } }
})
