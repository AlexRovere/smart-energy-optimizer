import { DuckDBInstance } from '@duckdb/node-api'
import { energyReadingSchema, type EnergyReading } from '../../shared/energyReadingSchema'

function résoudreRépertoireParquet(): string {
  const dir = process.env.NUXT_PARQUET_DIR
  if (!dir) throw new Error("NUXT_PARQUET_DIR n'est pas défini — historique indisponible")
  return dir
}

function normaliserLigne(ligne: Record<string, unknown>): Record<string, unknown> {
  const ts = ligne.timestamp
  return {
    ...ligne,
    // DuckDB renvoie les timestamps comme objets Date ; on les convertit en chaîne ISO 8601
    timestamp: ts instanceof Date ? ts.toISOString() : ts,
    null_reasons: ligne.null_reasons ?? []
  }
}

export async function querySiteHistory(
  siteId: string,
  from: string,
  to: string,
  limit: number
): Promise<EnergyReading[]> {
  const dir = résoudreRépertoireParquet()

  const sql = `
    SELECT
      timestamp, site_id, site_type,
      consumption_kw, consumption_kw_raw, consumption_kwh,
      voltage_v, current_a, power_factor,
      temperature_celsius, humidity_percent,
      null_reasons, data_quality
    FROM read_parquet('${dir}/**/*.parquet', hive_partitioning = true)
    WHERE site_id = '${siteId}'
      AND timestamp >= TIMESTAMPTZ '${from}'
      AND timestamp < TIMESTAMPTZ '${to}'
    ORDER BY timestamp ASC
    LIMIT ${limit}
  `

  const instance = await DuckDBInstance.create(':memory:')
  const connexion = await instance.connect()
  const déclaration = await connexion.prepare(sql)
  const résultat = await déclaration.run()

  const mesures: EnergyReading[] = []
  for await (const ligne of résultat) {
    const parse = energyReadingSchema.safeParse(normaliserLigne(ligne as unknown as Record<string, unknown>))
    if (parse.success) {
      mesures.push(parse.data)
    }
    // Une ligne invalide est ignorée silencieusement plutôt que de casser toute la réponse
  }
  return mesures
}
