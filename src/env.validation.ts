import { plainToInstance } from "class-transformer"
import { IsEnum, IsNumber, IsString, IsUrl, Matches, MinLength, validateSync } from "class-validator"

export enum Environment {
  Development = "development",
  Production = "production",
  Test = "test",
  Staging = "staging"
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment

  @IsNumber()
  PORT: number

  @IsUrl({ require_tld: false })
  APP_URL: string

  @IsString()
  @Matches(/^(postgres|postgresql):\/\//, {
    message: 'DATABASE_URL must start with "postgresql://"'
  })
  DATABASE_URL: string

  @IsString()
  REDIS_HOST: string

  @IsNumber()
  REDIS_PORT: number

  // HS256 is only as strong as its secret; refuse to boot with a short/guessable one.
  @IsString()
  @MinLength(32, { message: "JWT_SECRET must be at least 32 characters" })
  JWT_SECRET: string

  @IsString()
  @Matches(/^\d+[smhd]?$/, { message: 'JWT_EXPIRES_IN must look like "900", "15m", "1h" or "1d"' })
  JWT_EXPIRES_IN: string
}

export interface AppConfig {
  PORT: number
  NODE_ENV: Environment
  APP_URL: string
}

export interface DbConfig {
  DATABASE_URL: string
}

export interface RedisConfig {
  REDIS_HOST: string
  REDIS_PORT: number
}

export interface JwtConfig {
  JWT_SECRET: string
  JWT_EXPIRES_IN: string
}

export interface IAppConfigurations {
  appConfig: AppConfig
  dbConfig: DbConfig
  redisConfig: RedisConfig
  jwtConfig: JwtConfig
}

export function validate(config: Record<string, unknown>): IAppConfigurations {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true
  })

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false
  })

  if (errors.length > 0) {
    throw new Error(errors.toString())
  }

  const { PORT, NODE_ENV, APP_URL, DATABASE_URL, REDIS_HOST, REDIS_PORT, JWT_SECRET, JWT_EXPIRES_IN } = validatedConfig

  return {
    appConfig: {
      PORT,
      NODE_ENV,
      APP_URL
    },
    dbConfig: {
      DATABASE_URL
    },
    redisConfig: {
      REDIS_HOST,
      REDIS_PORT
    },
    jwtConfig: {
      JWT_SECRET,
      JWT_EXPIRES_IN
    }
  }
}
