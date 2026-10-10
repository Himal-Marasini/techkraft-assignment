import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator"

export class AuthLoginDTO {
  @ApiProperty({ description: "User email", example: "sales1@techkraft.test" })
  @Transform((params) => (typeof params.value === "string" ? params.value.trim().toLowerCase() : params.value))
  @IsEmail({}, { message: "Email must be a valid email address" })
  @MaxLength(254)
  email: string

  @ApiProperty({ description: "User password", example: "<your SEED_USER_PASSWORD>" })
  @IsNotEmpty({ message: "Password is required" })
  @IsString({ message: "Password must be a string" })
  @MaxLength(128)
  password: string
}
