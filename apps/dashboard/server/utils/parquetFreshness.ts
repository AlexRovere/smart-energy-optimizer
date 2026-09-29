// Date de la dernière donnée de chaque site, sans parcourir tout l'historique :
// on descend site_id= / year= / month= / day= en ne gardant à chaque niveau que
// la partition la plus récente, et DuckDB n'ouvre que ce dernier jour. Le coût
// ne croît donc pas avec la profondeur de l'historique (voir #41 pour le ML).
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'

let instancePromise: ReturnType<typeof DuckDBInstance.create> | null = null

function getInstance() {
  instancePromise ??= DuckDBInstance.create(':memory:')
  return instancePromise
}

async function partitions(dir: string, key: string): Promise<{ value: string; path: string }[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const prefix = `${key}=`
  return entries
    .filter(e => e.isDirectory() && e.name.startsWith(prefix))
    .map(e => ({ value: e.name.slice(prefix.length), path: join(dir, e.name) }))
}

// Numérique : « month=10 » doit passer après « month=9 », avec ou sans zéro initial.
async function latestPartition(dir: string, key: string): Promise<string | null> {
  const found = await partitions(dir, key)
  if (!found.length) return null
  return found.reduce((a, b) => (Number(b.value) > Number(a.value) ? b : a), found[0]!).path
}

async function latestTimestamp(dayDir: string): Promise<string | null> {
  const connexion = await (await getInstance()).connect()
  const pattern = join(dayDir, '*.parquet').replaceAll('\\', '/')
  const result = await connexion.runAndReadAll(`SELECT max(timestamp) AS last FROM read_parquet('${pattern}')`)
  const last = result.getRowObjectsJS()[0]?.last
  return last instanceof Date ? last.toISOString() : null
}

export async function latestDataPerSite(parquetDir: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const site of await partitions(parquetDir, 'site_id')) {
    let dir: string | null = site.path
    for (const key of ['year', 'month', 'day']) {
      dir = dir && await latestPartition(dir, key)
    }
    const last = dir && await latestTimestamp(dir)
    if (last) result[site.value] = last
  }
  return result
}
