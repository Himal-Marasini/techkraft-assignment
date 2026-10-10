import { BullModule } from "@nestjs/bullmq"
import { ClassSerializerInterceptor, MiddlewareConsumer, Module, NestModule, ValidationPipe } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core"
import { JwtModule } from "@nestjs/jwt"
import { ScheduleModule } from "@nestjs/schedule"
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler"

import { JwtConfig, RedisConfig, validate } from "./env.validation"
import { AllExceptionsFilter, RequestLoggerMiddleware } from "./middlewares"
import { AuthModule } from "./modules/auth/auth.module"
import { MerchantApplicationsModule } from "./modules/merchant-applications/merchant-applications.module"
import { DatabaseModule } from "./typeorm/database.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
      isGlobal: true
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { JWT_SECRET, JWT_EXPIRES_IN } = config.get<JwtConfig>("jwtConfig")
        return {
          secret: JWT_SECRET,
          signOptions: { algorithm: "HS256", expiresIn: JWT_EXPIRES_IN },
          verifyOptions: { algorithms: ["HS256"] }
        }
      }
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { REDIS_HOST, REDIS_PORT } = config.get<RedisConfig>("redisConfig")
        // e2e tests get their own key prefix, so a dev server on the same Redis can't take their jobs.
        const prefix = process.env.NODE_ENV === "test" ? "bull-test" : "bull"
        return { connection: { host: REDIS_HOST, port: REDIS_PORT }, prefix }
      }
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      skipIf: () => process.env.NODE_ENV === "test"
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    MerchantApplicationsModule
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        // Fields the client didn't send stay absent instead of becoming `undefined` (matters for PATCH).
        transformOptions: { exposeUnsetFields: false }
      })
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Applies @Exclude/@Expose on entities: password hashes and full tax ids never leave the API.
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*")
  }
}
