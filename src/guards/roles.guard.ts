import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { ROLES_KEY } from "src/common/decorators/roles.decorator"
import { AuthenticatedRequest } from "src/common/interfaces"
import { Role } from "src/modules/users/users.constant"

/** Role check. Must run after AuthGuard. Object-level rules (ownership, assignment) live in the services. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()])
    if (!roles?.length) return true

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException("You do not have permission to perform this action")
    }

    return true
  }
}
