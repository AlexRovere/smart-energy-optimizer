import { DuckDBInstance } from '@duckdb/node-api'
import { energyReadingSchema, type EnergyReading } from '../../shared/energyReadingSchema'

let instancePromise: ReturnType<typeof DuckDBInstance.create> | null = null

export function resetInstanceForTests(): void {
  instancePromise = null
}

function getInstance() {
  if (!instancePromise) {
    instancePromise = DuckDBInstance.create(':memory:')
  }
  return instancePromise
}

function resolveParquetDir(): string {
  const dir = process.env.NUXT_PARQUET_DIR
  if (!dir) throw new Error("NUXT_PARQUET_DIR n'est pas défini — historique indisponible")
  return dir
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const ts = row.timestamp
  return {
    ...row,
    // DuckDB renvoie les timestamps comme objets Date ; on les convertit en chaîne ISO 8601
    timestamp: ts instanceof Date ? ts.toISOString() : ts,
    null_reasons: row.null_reasons ?? []
  }
}

export async function querySiteHistory(
  siteId: string,
  from: string,
  to: string,
  limit: number
): Promise<EnergyReading[]> {
  const dir = resolveParquetDir()

  const sql = `
    SELECT
      timestamp, site_id, site_type,
      consumption_kw, consumption_kw_corrected, consumption_kwh,
      voltage_v, current_a, power_factor,
      temperature_celsius, humidity_percent,
      null_reasons, data_quality
    FROM read_parquet('${dir}/site_id=*/**/*.parquet', hive_partitioning = true)
    WHERE site_id = '${siteId}'
      AND timestamp >= TIMESTAMPTZ '${from}'
      AND timestamp < TIMESTAMPTZ '${to}'
    ORDER BY timestamp ASC
    LIMIT ${limit}
  `

  const instance = await getInstance()
  const connection = await instance.connect()
  const statement = await connection.prepare(sql)
  const result = await statement.runAndReadAll()

  const readingRows: EnergyReading[] = []
  for (const row of result.getRowObjectsJS()) {
    const parse = energyReadingSchema.safeParse(normalizeRow(row as Record<string, unknown>))
    if (parse.success) {
      readingRows.push(parse.data)
    }
    else {
      console.warn(
        `[parquetReader] ligne rejetée site_id=${(row as Record<string, unknown>).site_id} timestamp=${(row as Record<string, unknown>).timestamp} :`,
        parse.error.issues
      )
    }
  }
  return readingRows
}
