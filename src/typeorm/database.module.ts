import { Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"

import { DbConfig } from "../env.validation"
import { buildDataSourceOptions } from "./typeorm.config"

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { DATABASE_URL } = config.get<DbConfig>("dbConfig")
        const options = buildDataSourceOptions(DATABASE_URL)
        return { ...options, autoLoadEntities: true }
      }
    })
  ]
})
export class DatabaseModule {}
