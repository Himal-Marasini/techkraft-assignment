import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  ValidateIf
} from "class-validator"
import { PaginationQueryDto } from "src/common/dto"

import { ApplicationStatus, BusinessType, REVIEW_DECISION_STATUSES } from "./merchant-applications.constant"

const MAX_AMOUNT = 999_999_999_999.99 // fits NUMERIC(14,2)

export class CreateMerchantApplicationDTO {
  @ApiProperty({ description: "Trading / doing-business-as name", example: "Everest Coffee House" })
  @IsString()
  @IsNotEmpty({ message: "Business name is required" })
  @MaxLength(200)
  businessName: string

  @ApiProperty({ description: "Registered legal name", example: "Everest Coffee House Pvt. Ltd." })
  @IsString()
  @IsNotEmpty({ message: "Legal business name is required" })
  @MaxLength(200)
  legalBusinessName: string

  @ApiProperty({ enum: BusinessType, example: BusinessType.PARTNERSHIP })
  @IsEnum(BusinessType, { message: `businessType must be one of: ${Object.values(BusinessType).join(", ")}` })
  businessType: BusinessType

  @ApiProperty({
    description: "Business tax / registration number. Stored but only ever returned masked.",
    example: "00-0000000"
  })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{5,32}$/, { message: "taxId must be 5-32 letters, digits or dashes" })
  taxId: string

  @ApiProperty({ description: "Owner / primary contact full name", example: "Jane Example" })
  @IsString()
  @IsNotEmpty({ message: "Owner full name is required" })
  @MaxLength(150)
  ownerFullName: string

  @ApiProperty({ description: "Owner / primary contact email", example: "jane.owner@example.com" })
  @Transform((params) => (typeof params.value === "string" ? params.value.trim().toLowerCase() : params.value))
  @IsEmail({}, { message: "ownerEmail must be a valid email address" })
  @MaxLength(254)
  ownerEmail: string

  @ApiProperty({ description: "Expected monthly card volume", example: 50000 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: "expectedMonthlyVolume must be a number with at most 2 decimals" })
  @IsPositive()
  @Max(MAX_AMOUNT)
  expectedMonthlyVolume: number

  @ApiProperty({ description: "Average transaction amount", example: 45.5 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: "averageTicketSize must be a number with at most 2 decimals" })
  @IsPositive()
  @Max(MAX_AMOUNT)
  averageTicketSize: number
}

export class UpdateMerchantApplicationDTO extends PartialType(CreateMerchantApplicationDTO, {
  skipNullProperties: false
}) {}

export class ListMerchantApplicationsQueryDTO extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ApplicationStatus, description: "Filter by application status" })
  @IsOptional()
  @IsEnum(ApplicationStatus, { message: `status must be one of: ${Object.values(ApplicationStatus).join(", ")}` })
  status?: ApplicationStatus
}

export class AssignReviewerDTO {
  @ApiProperty({ description: "Id of a user with the REVIEWER role", example: "7c9e6679-7425-40de-944b-e07fc1f90ae7" })
  @IsUUID("all", { message: "reviewerId must be a valid UUID" })
  reviewerId: string
}

export class RecordDecisionDTO {
  @ApiProperty({ enum: REVIEW_DECISION_STATUSES, example: ApplicationStatus.APPROVED })
  @IsIn(REVIEW_DECISION_STATUSES, { message: `decision must be one of: ${REVIEW_DECISION_STATUSES.join(", ")}` })
  decision: ApplicationStatus

  @ApiPropertyOptional({
    description: "Required when rejecting or requesting information; optional when approving",
    example: "Please upload the latest bank statement.",
    nullable: true
  })
  // Validated whenever it's required (reject / request info) or was sent anyway.
  @ValidateIf((dto: RecordDecisionDTO) => dto.decision !== ApplicationStatus.APPROVED || dto.reason !== null)
  @IsString()
  @IsNotEmpty({ message: "reason is required when rejecting or requesting information" })
  @MaxLength(1000)
  reason: string | null = null
}
