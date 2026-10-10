import { Body, Controller, Post } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"

import { AUTH_SUCCESS_MESSAGE, LOGIN_THROTTLE } from "./auth.constant"
import { AuthLoginDTO } from "./auth.dto"
import { AuthService } from "./auth.service"
import { postAuthLoginDocs } from "./auth.swagger"

@Controller()
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post("/auth/login")
  @Throttle(LOGIN_THROTTLE)
  @postAuthLoginDocs.operation
  @postAuthLoginDocs.responses.success
  @postAuthLoginDocs.responses.badRequest
  @postAuthLoginDocs.responses.unauthorized
  @postAuthLoginDocs.responses.tooManyRequests
  async postAuthLogin(@Body() payload: AuthLoginDTO) {
    const response = await this.service.postAuthLogin(payload)

    return {
      success: true,
      message: AUTH_SUCCESS_MESSAGE.SUCCESS_ON_LOGIN,
      data: response
    }
  }
}
