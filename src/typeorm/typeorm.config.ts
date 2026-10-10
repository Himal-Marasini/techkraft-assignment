import * as path from "path"

import { DataSourceOptions } from "typeorm"
import { SnakeNamingStrategy } from "typeorm-naming-strategies"

// .ts under ts-node/jest, .js once compiled — keeps TypeORM from loading emitted .d.ts files.
const ext = path.extname(__filename)

/** Shared by the Nest app (DatabaseModule) and the TypeORM CLI (data-source.ts). */
export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: "postgres",
    url,
    entities: [path.join(__dirname, "..", "**", `*.entity${ext}`)],
    migrations: [path.join(__dirname, "migrations", `*${ext}`)],
    namingStrategy: new SnakeNamingStrategy(),
    // gen_random_uuid() is built into PostgreSQL 13+, no uuid-ossp extension needed.
    uuidExtension: "pgcrypto",
    // Schema changes go through reviewed migrations only.
    synchronize: false
  }
}
