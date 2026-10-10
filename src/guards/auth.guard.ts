import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { Request } from "express"
import { AuthenticatedRequest, IJwtPayload } from "src/common/interfaces"

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const accessToken = this.extractTokenFromHeader(request)
    if (!accessToken) throw new UnauthorizedException("Missing access token")

    try {
      // Secret, algorithm (HS256 only) and expiry are configured once on the global JwtModule.
      const payload = await this.jwtService.verifyAsync<IJwtPayload>(accessToken)
      request.user = { id: payload.sub, email: payload.email, role: payload.role }
    } catch {
      throw new UnauthorizedException("Invalid or expired access token")
    }

    return true
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? []
    return type === "Bearer" ? token : undefined
  }
}
