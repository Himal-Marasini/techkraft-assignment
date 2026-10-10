import { Exclude } from "class-transformer"
import { Column, Entity } from "typeorm"

import { AbstractEntity } from "../../typeorm/entities/base.entity"
import { Role } from "./users.constant"

@Entity("users")
export class User extends AbstractEntity {
  @Column({ length: 254, unique: true })
  email: string

  @Exclude()
  @Column({ select: false })
  passwordHash: string

  @Column({ type: "enum", enum: Role, enumName: "user_role" })
  role: Role
}
