import "dotenv/config"

import { DataSource } from "typeorm"

import { buildDataSourceOptions } from "./typeorm.config"

// Used only by the TypeORM CLI for migrations; the app connects via DatabaseModule.
const options = buildDataSourceOptions(process.env.DATABASE_URL)

export default new DataSource(options)
