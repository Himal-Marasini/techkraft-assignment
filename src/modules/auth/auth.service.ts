import { Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import * as bcrypt from "bcryptjs"
import { IJwtPayload } from "src/common/interfaces"

import { UsersService } from "../users/users.service"
import { AUTH_ERROR_MESSAGE, DUMMY_PASSWORD_HASH } from "./auth.constant"
import { AuthLoginDTO } from "./auth.dto"

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  async postAuthLogin(payload: AuthLoginDTO) {
    const record = await this.usersService.findByEmailWithPassword(payload.email)

    // Always run bcrypt, even for unknown emails, so timing doesn't reveal which accounts exist.
    const isPasswordValid = await bcrypt.compare(payload.password, record?.passwordHash ?? DUMMY_PASSWORD_HASH)
    if (!record || !isPasswordValid) throw new UnauthorizedException(AUTH_ERROR_MESSAGE.INVALID_CREDENTIALS)

    const tokenPayload: IJwtPayload = { sub: record.id, email: record.email, role: record.role }
    const accessToken = await this.jwtService.signAsync(tokenPayload)

    return {
      accessToken,
      user: { id: record.id, email: record.email, role: record.role }
    }
  }
}
