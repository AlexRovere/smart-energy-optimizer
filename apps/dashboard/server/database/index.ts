import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from './schema'
import { buildDatabaseUrl } from './databaseUrl'

const config = useRuntimeConfig()
const client = postgres(buildDatabaseUrl({ url: config.databaseUrl, ...config.postgres }))
export const db = drizzle(client, { schema })