import { UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import * as bcrypt from "bcryptjs"

import { User } from "../../users/user.entity"
import { Role } from "../../users/users.constant"
import { UsersService } from "../../users/users.service"
import { AUTH_ERROR_MESSAGE } from "../auth.constant"
import { AuthService } from "../auth.service"

describe("AuthService.postAuthLogin", () => {
  const password = "correct-password"
  let user: User
  let usersService: jest.Mocked<UsersService>
  let jwtService: jest.Mocked<JwtService>
  let service: AuthService

  beforeAll(async () => {
    user = Object.assign(new User(), {
      id: "user-1",
      email: "sales1@techkraft.test",
      role: Role.SALES,
      passwordHash: await bcrypt.hash(password, 4)
    })
  })

  beforeEach(() => {
    usersService = { findByEmailWithPassword: jest.fn() } as unknown as jest.Mocked<UsersService>
    jwtService = { signAsync: jest.fn().mockResolvedValue("signed.jwt.token") } as unknown as jest.Mocked<JwtService>
    service = new AuthService(usersService, jwtService)
  })

  it("issues a token with id and role claims, and never returns the password hash", async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(user)

    const result = await service.postAuthLogin({ email: user.email, password })

    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: "user-1", email: user.email, role: Role.SALES })
    expect(result.accessToken).toBe("signed.jwt.token")
    expect(result.user).not.toHaveProperty("passwordHash")
  })

  it("rejects a wrong password", async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(user)

    await expect(service.postAuthLogin({ email: user.email, password: "wrong" })).rejects.toThrow(
      new UnauthorizedException(AUTH_ERROR_MESSAGE.INVALID_CREDENTIALS)
    )
  })

  it("rejects an unknown email with the same message (no account enumeration)", async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(null)

    await expect(service.postAuthLogin({ email: "nobody@techkraft.test", password })).rejects.toThrow(
      new UnauthorizedException(AUTH_ERROR_MESSAGE.INVALID_CREDENTIALS)
    )
    expect(jwtService.signAsync).not.toHaveBeenCalled()
  })
})
