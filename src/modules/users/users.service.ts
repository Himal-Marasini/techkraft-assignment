import { Injectable } from "@nestjs/common"

import { UsersRepository } from "./users.repository"

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  findById(id: string) {
    return this.repository.findById(id)
  }

  findByEmailWithPassword(email: string) {
    return this.repository.findByEmailWithPassword(email)
  }
}
