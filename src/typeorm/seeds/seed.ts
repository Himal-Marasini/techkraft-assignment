import "dotenv/config"

import * as bcrypt from "bcryptjs"

import { User } from "../../modules/users/user.entity"
import { Role } from "../../modules/users/users.constant"
import dataSource from "../data-source"

// Fictional users on the reserved .test TLD — no real personal data.
const SEED_USERS: Pick<User, "email" | "role">[] = [
  { email: "admin@techkraft.test", role: Role.ADMIN },
  { email: "reviewer1@techkraft.test", role: Role.REVIEWER },
  { email: "reviewer2@techkraft.test", role: Role.REVIEWER },
  { email: "sales1@techkraft.test", role: Role.SALES },
  { email: "sales2@techkraft.test", role: Role.SALES }
]

/** Idempotent: re-running updates the existing users (by email) instead of duplicating them. */
async function seed() {
  const password = process.env.SEED_USER_PASSWORD
  if (!password || password.length < 8) {
    throw new Error("Set SEED_USER_PASSWORD (min 8 chars) in .env before seeding")
  }

  await dataSource.initialize()
  const passwordHash = await bcrypt.hash(password, 10)

  const users = SEED_USERS.map((user) => ({ ...user, passwordHash }))
  const userRepository = dataSource.getRepository(User)
  await userRepository.upsert(users, ["email"])
  await dataSource.destroy()

  console.table(SEED_USERS)
  console.log("All seeded users share the password from SEED_USER_PASSWORD.")
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
