import { Request } from "express"
import { Role } from "src/modules/users/users.constant"

/** Claims we put in the access token. `sub` is the user id. */
export interface IJwtPayload {
  sub: string
  email: string
  role: Role
}

/** The caller, as attached to the request by AuthGuard. */
export interface IAuthUser {
  id: string
  email: string
  role: Role
}

export interface AuthenticatedRequest extends Request {
  user: IAuthUser
}
