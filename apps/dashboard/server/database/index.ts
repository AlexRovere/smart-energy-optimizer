import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from './schema'
import { buildDatabaseUrl, type DatabaseSettings } from './databaseUrl'

const config = useRuntimeConfig()
const pg = config.postgres as DatabaseSettings
const client = postgres(buildDatabaseUrl({ url: config.databaseUrl, ...pg }))
export const db = drizzle(client, { schema })