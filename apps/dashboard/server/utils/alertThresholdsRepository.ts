// Lecture des seuils d'alerte réglés par site, avec repli sur des valeurs par défaut fournies par l'appelant (#175, #176).
import { and, eq } from 'drizzle-orm'
import { alertThresholds } from '../database/schema'
import type { AppDatabase } from './session'

export interface AlertThreshold {
  duration: number
  threshold: number
}

export async function getAlertThreshold(
  db: AppDatabase,
  siteId: string,
  type: 'conso' | 'pic',
  defauts: AlertThreshold
): Promise<AlertThreshold> {
  const [ligne] = await db
    .select({ duration: alertThresholds.duration, threshold: alertThresholds.threshold })
    .from(alertThresholds)
    .where(and(eq(alertThresholds.siteId, siteId), eq(alertThresholds.type, type)))

  return ligne ?? defauts
}
