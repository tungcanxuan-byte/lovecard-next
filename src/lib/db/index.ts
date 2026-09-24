import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

/**
 * Postgres (Neon) when DATABASE_URL is set; otherwise an embedded PGlite database in .data/pglite so
 * the app runs end to end locally with no setup. PGlite applies migrations itself on first use; real
 * databases are migrated with `pnpm db:migrate`.
 */
async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return drizzlePostgres(postgres(url, { prepare: false, max: 5 }), { schema });

  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const dir = path.join(process.cwd(), ".data/pglite");
  await mkdir(dir, { recursive: true });
  const db = drizzle(new PGlite(dir), { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  // Same query builder API; only the driver differs.
  return db as unknown as Db;
}

// One connection per server process, surviving dev hot reloads.
const g = globalThis as unknown as { __lcDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  g.__lcDb ??= connect().catch((err) => {
    g.__lcDb = undefined;
    throw err;
  });
  return g.__lcDb;
}

export { schema };
