import { existsSync } from 'node:fs'
import { join } from 'node:path'
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

const DAY_MS = 86_400_000

// Fichiers des seuls jours de la plage, d'après le partitionnement de l'ETL
// (docs/data.md : year=AAAA/month=MM/day=JJ/). Le motif site_id=*/**/*.parquet
// faisait ouvrir tout l'historique du site à chaque lecture, quelle que soit
// la plage demandée (#41, #46).
export function dayFiles(dir: string, siteId: string, from: string, to: string): string[] {
  const files: string[] = []
  const end = Date.parse(to)
  for (let day = Math.floor(Date.parse(from) / DAY_MS) * DAY_MS; day < end; day += DAY_MS) {
    const date = new Date(day)
    const dayDir = join(
      dir,
      `site_id=${siteId}`,
      `year=${date.getUTCFullYear()}`,
      `month=${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
      `day=${String(date.getUTCDate()).padStart(2, '0')}`
    )
    // Tout .parquet du jour : l'ETL n'en écrit qu'un, rien n'oblige à s'y fier.
    if (existsSync(dayDir)) files.push(join(dayDir, '*.parquet').replaceAll('\\', '/'))
  }
  return files
}

export async function querySiteHistory(
  siteId: string,
  from: string,
  to: string,
  limit: number
): Promise<EnergyReading[]> {
  const dir = resolveParquetDir()
  const files = dayFiles(dir, siteId, from, to)
  if (!files.length) return []
  const source = files.map(file => `'${file.replaceAll("'", "''")}'`).join(', ')

  const sql = `
    SELECT
      timestamp, site_id, site_type,
      consumption_kw, consumption_kw_corrected, consumption_kwh,
      voltage_v, current_a, power_factor,
      temperature_celsius, humidity_percent,
      null_reasons, data_quality
    FROM read_parquet([${source}], hive_partitioning = true)
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
