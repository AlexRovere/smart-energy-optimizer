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

export interface AlertThresholdEntry extends AlertThreshold {
  siteId: string
  type: 'conso' | 'pic'
}

const DÉFAUTS: Record<'conso' | 'pic', AlertThreshold> = {
  conso: { duration: 5, threshold: 200 },
  pic: { duration: 5, threshold: 1.5 }
}

export async function listAlertThresholds(db: AppDatabase, siteIds: string[]): Promise<AlertThresholdEntry[]> {
  const entrées: AlertThresholdEntry[] = []
  for (const siteId of siteIds) {
    for (const type of ['conso', 'pic'] as const) {
      entrées.push({ siteId, type, ...await getAlertThreshold(db, siteId, type, DÉFAUTS[type]) })
    }
  }
  return entrées
}

export async function upsertAlertThreshold(
  db: AppDatabase,
  siteId: string,
  type: 'conso' | 'pic',
  valeurs: AlertThreshold
): Promise<void> {
  await db
    .insert(alertThresholds)
    .values({ siteId, type, duration: valeurs.duration, threshold: valeurs.threshold })
    .onConflictDoUpdate({
      target: [alertThresholds.siteId, alertThresholds.type],
      set: { duration: valeurs.duration, threshold: valeurs.threshold }
    })
}
