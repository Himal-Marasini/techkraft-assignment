import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { useContainer } from "class-validator"
import compression from "compression"
import * as useragent from "express-useragent"
import helmet from "helmet"

import { AppModule } from "./app.module"
import { AppConfig } from "./env.validation"
import { logger } from "./utils"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  useContainer(app.select(AppModule), { fallbackOnErrors: true })

  app.enableShutdownHooks()
  app.setGlobalPrefix("/api/v1")

  const configService = app.get(ConfigService)
  const appConfig = configService.get<AppConfig>("appConfig")

  app.enableCors()

  app.use(compression())
  app.use(useragent.express())

  // Swagger Documentation - Only enable in non-production environments.
  if (appConfig.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("TechKraft Merchant Onboarding API")
      .setDescription("API Documentation For Merchant Application Onboarding & Risk Review")
      .setVersion("1.0")
      .addBearerAuth()
      .build()

    const documentFactory = () => SwaggerModule.createDocument(app, config)
    SwaggerModule.setup("api-docs", app, documentFactory, {
      swaggerOptions: {
        defaultModelsExpandDepth: -1,
        persistAuthorization: true
      }
    })

    logger.info(`Swagger documentation enabled at ${appConfig.APP_URL}:${appConfig.PORT}/api-docs`)
  } else {
    logger.info("Swagger documentation disabled in production environment")
  }

  app.use(helmet())

  await app.listen(appConfig.PORT)
  logger.info(`Server is running on ${appConfig.APP_URL}:${appConfig.PORT}/api/v1 with process id: ${process.pid}`)
}
bootstrap()
