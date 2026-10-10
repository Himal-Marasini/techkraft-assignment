import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common"
import { ApiBearerAuth } from "@nestjs/swagger"
import { Roles } from "src/common/decorators/roles.decorator"
import { AuthenticatedRequest } from "src/common/interfaces"
import { AuthGuard } from "src/guards/auth.guard"
import { RolesGuard } from "src/guards/roles.guard"

import { Role } from "../users/users.constant"
import { MERCHANT_APPLICATION_SUCCESS_MESSAGE as SUCCESS_MESSAGE } from "./merchant-applications.constant"
import {
  AssignReviewerDTO,
  CreateMerchantApplicationDTO,
  ListMerchantApplicationsQueryDTO,
  RecordDecisionDTO,
  UpdateMerchantApplicationDTO
} from "./merchant-applications.dto"
import { MerchantApplicationsService } from "./merchant-applications.service"
import {
  getMerchantApplicationDocs,
  getMerchantApplicationsDocs,
  patchMerchantApplicationDocs,
  postAssignReviewerDocs,
  postMerchantApplicationDocs,
  postRecordDecisionDocs,
  postSubmitMerchantApplicationDocs
} from "./merchant-applications.swagger"

@Controller()
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
export class MerchantApplicationsController {
  constructor(private readonly service: MerchantApplicationsService) {}

  // done
  @Get("/merchant-applications")
  @getMerchantApplicationsDocs.operation
  @getMerchantApplicationsDocs.responses.success
  @getMerchantApplicationsDocs.responses.badRequest
  @getMerchantApplicationsDocs.responses.unauthorized
  async getMerchantApplications(@Req() req: AuthenticatedRequest, @Query() query: ListMerchantApplicationsQueryDTO) {
    const { records, totalCount } = await this.service.getMerchantApplications(req.user, query)

    return {
      success: true,
      message: SUCCESS_MESSAGE.FETCHED_LIST,
      data: records,
      totalCount
    }
  }

  // done
  @Post("/merchant-applications")
  @Roles(Role.SALES, Role.ADMIN)
  @postMerchantApplicationDocs.operation
  @postMerchantApplicationDocs.responses.success
  @postMerchantApplicationDocs.responses.badRequest
  @postMerchantApplicationDocs.responses.unauthorized
  @postMerchantApplicationDocs.responses.forbidden
  async postMerchantApplication(@Req() req: AuthenticatedRequest, @Body() payload: CreateMerchantApplicationDTO) {
    const response = await this.service.postMerchantApplication(req.user, payload)

    return {
      success: true,
      message: SUCCESS_MESSAGE.CREATED,
      data: response
    }
  }

  // done
  @Get("/merchant-applications/:id")
  @getMerchantApplicationDocs.operation
  @getMerchantApplicationDocs.param
  @getMerchantApplicationDocs.responses.success
  @getMerchantApplicationDocs.responses.badRequest
  @getMerchantApplicationDocs.responses.unauthorized
  @getMerchantApplicationDocs.responses.notFound
  async getMerchantApplication(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const response = await this.service.getMerchantApplication(req.user, id)

    return {
      success: true,
      message: SUCCESS_MESSAGE.FETCHED,
      data: response
    }
  }

  // done
  @Patch("/merchant-applications/:id")
  @Roles(Role.SALES, Role.ADMIN)
  @patchMerchantApplicationDocs.operation
  @patchMerchantApplicationDocs.param
  @patchMerchantApplicationDocs.responses.success
  @patchMerchantApplicationDocs.responses.badRequest
  @patchMerchantApplicationDocs.responses.unauthorized
  @patchMerchantApplicationDocs.responses.forbidden
  @patchMerchantApplicationDocs.responses.notFound
  @patchMerchantApplicationDocs.responses.conflict
  async patchMerchantApplication(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() payload: UpdateMerchantApplicationDTO
  ) {
    const response = await this.service.patchMerchantApplication(req.user, id, payload)

    return {
      success: true,
      message: SUCCESS_MESSAGE.UPDATED,
      data: response
    }
  }

  // done
  @Post("/merchant-applications/:id/assign")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @postAssignReviewerDocs.operation
  @postAssignReviewerDocs.param
  @postAssignReviewerDocs.responses.success
  @postAssignReviewerDocs.responses.badRequest
  @postAssignReviewerDocs.responses.unauthorized
  @postAssignReviewerDocs.responses.forbidden
  @postAssignReviewerDocs.responses.notFound
  @postAssignReviewerDocs.responses.conflict
  async postAssignReviewer(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() payload: AssignReviewerDTO
  ) {
    const response = await this.service.postAssignReviewer(req.user, id, payload)

    return {
      success: true,
      message: SUCCESS_MESSAGE.ASSIGNED,
      data: response
    }
  }

  @Post("/merchant-applications/:id/decision")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.REVIEWER)
  @postRecordDecisionDocs.operation
  @postRecordDecisionDocs.param
  @postRecordDecisionDocs.responses.success
  @postRecordDecisionDocs.responses.badRequest
  @postRecordDecisionDocs.responses.unauthorized
  @postRecordDecisionDocs.responses.forbidden
  @postRecordDecisionDocs.responses.notFound
  @postRecordDecisionDocs.responses.conflict
  async postRecordDecision(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() payload: RecordDecisionDTO
  ) {
    const response = await this.service.postRecordDecision(req.user, id, payload)

    return {
      success: true,
      message: SUCCESS_MESSAGE.DECISION_RECORDED,
      data: response
    }
  }

  @Post("/merchant-applications/:id/submit")
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(Role.SALES, Role.ADMIN)
  @postSubmitMerchantApplicationDocs.operation
  @postSubmitMerchantApplicationDocs.param
  @postSubmitMerchantApplicationDocs.responses.success
  @postSubmitMerchantApplicationDocs.responses.unauthorized
  @postSubmitMerchantApplicationDocs.responses.forbidden
  @postSubmitMerchantApplicationDocs.responses.notFound
  @postSubmitMerchantApplicationDocs.responses.conflict
  async postSubmitMerchantApplication(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const response = await this.service.postSubmitMerchantApplication(req.user, id)

    return {
      success: true,
      message: SUCCESS_MESSAGE.SUBMITTED,
      data: response
    }
  }
}
