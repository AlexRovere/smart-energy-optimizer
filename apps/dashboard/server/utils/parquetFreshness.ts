// Première et dernière donnée de chaque site, sans parcourir tout l'historique :
// on descend site_id= / year= / month= / day= en ne gardant à chaque niveau que
// la partition extrême, et DuckDB n'ouvre que ce seul jour. Le coût ne croît
// donc pas avec la profondeur de l'historique (voir #41 pour le ML).
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'

type Edge = 'earliest' | 'latest'

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
async function edgePartition(dir: string, key: string, edge: Edge): Promise<string | null> {
  const found = await partitions(dir, key)
  if (!found.length) return null
  const wanted = (a: { value: string }, b: { value: string }) =>
    edge === 'latest' ? Number(b.value) > Number(a.value) : Number(b.value) < Number(a.value)
  return found.reduce((a, b) => (wanted(a, b) ? b : a), found[0]!).path
}

async function edgeTimestamp(dayDir: string, edge: Edge): Promise<string | null> {
  const connection = await (await getInstance()).connect()
  const pattern = join(dayDir, '*.parquet').replaceAll('\\', '/')
  const aggregate = edge === 'latest' ? 'max' : 'min'
  const result = await connection.runAndReadAll(`SELECT ${aggregate}(timestamp) AS edge FROM read_parquet('${pattern}')`)
  const value = result.getRowObjectsJS()[0]?.edge
  return value instanceof Date ? value.toISOString() : null
}

// Chaque niveau dépend du précédent : la descente d'un site est séquentielle,
// mais les sites se traitent en parallèle.
async function siteEdge(siteDir: string, edge: Edge): Promise<string | null> {
  const year = await edgePartition(siteDir, 'year', edge)
  const month = year && await edgePartition(year, 'month', edge)
  const day = month && await edgePartition(month, 'day', edge)
  return day && edgeTimestamp(day, edge)
}

async function edgeDataPerSite(parquetDir: string, edge: Edge): Promise<Record<string, string>> {
  const sites = await partitions(parquetDir, 'site_id')
  const edges = await Promise.all(sites.map(site => siteEdge(site.path, edge)))
  return Object.fromEntries(
    sites.flatMap((site, index) => (edges[index] ? [[site.value, edges[index]]] : []))
  )
}

export function latestDataPerSite(parquetDir: string): Promise<Record<string, string>> {
  return edgeDataPerSite(parquetDir, 'latest')
}

export function earliestDataPerSite(parquetDir: string): Promise<Record<string, string>> {
  return edgeDataPerSite(parquetDir, 'earliest')
}
