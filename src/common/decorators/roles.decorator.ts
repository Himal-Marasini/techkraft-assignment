import { SetMetadata } from "@nestjs/common"
import { Role } from "src/modules/users/users.constant"

export const ROLES_KEY = "roles"

/** Restricts a route (or controller) to the given roles. Enforced by RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)
