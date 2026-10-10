import "dotenv/config"

import { Client } from "pg"
import { DataSource } from "typeorm"

import { buildDataSourceOptions } from "../src/typeorm/typeorm.config"

/**
 * Runs once before the e2e suite: points the app at the test database,
 * creates it if missing and applies all migrations.
 */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.sample)")

  // Read by ConfigModule when each test boots AppModule.
  process.env.NODE_ENV = "test"
  process.env.DATABASE_URL = url

  await createDatabaseIfMissing(url)

  const dataSource = await new DataSource(buildDataSourceOptions(url)).initialize()
  await dataSource.runMigrations()
  await dataSource.destroy()
}

async function createDatabaseIfMissing(url: string) {
  const database = new URL(url).pathname.slice(1)
  const maintenanceUrl = new URL(url)
  maintenanceUrl.pathname = "/postgres"

  const client = new Client({ connectionString: maintenanceUrl.toString() })
  await client.connect()
  const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database])
  if (!rowCount) await client.query(`CREATE DATABASE "${database}"`)
  await client.end()
}
