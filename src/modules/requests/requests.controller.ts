import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../../entities/enums';
import {
  CreateRequestDto,
  UpdateRequestDto,
  RejectRequestDto,
  QueryRequestsDto,
} from './dto';

@Controller('requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  // POST /requests  [OPERATOR]
  @Post()
  @Roles(UserRole.OPERATOR)
  async create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user,
  ) {
    const data = await this.requestsService.create(dto, user);
    return { success: true, data };
  }

  // GET /requests  [OPERATOR, SUPERVISOR]
  @Get()
  @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR)
  async findAll(
    @Query() query: QueryRequestsDto,
    @CurrentUser() user,
  ) {
    return this.requestsService.findAll(query, user);
  }

  // GET /requests/:id  [OPERATOR, SUPERVISOR]
  @Get(':id')
  @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user,
  ) {
    const data = await this.requestsService.findOne(id, user);
    return { success: true, data };
  }

  // PATCH /requests/:id  [OPERATOR - own, PENDING only]
  @Patch(':id')
  @Roles(UserRole.OPERATOR)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestDto,
    @CurrentUser() user,
  ) {
    const data = await this.requestsService.update(id, dto, user);
    return { success: true, data };
  }

  // PATCH /requests/:id/approve  [SUPERVISOR]
  @Patch(':id/approve')
  @Roles(UserRole.SUPERVISOR)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user,
  ) {
    const data = await this.requestsService.approve(id, user);
    return { success: true, data };
  }

  // PATCH /requests/:id/reject  [SUPERVISOR]
  @Patch(':id/reject')
  @Roles(UserRole.SUPERVISOR)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRequestDto,
    @CurrentUser() user,
  ) {
    const data = await this.requestsService.reject(id, dto, user);
    return { success: true, data };
  }

  // PATCH /requests/:id/cancel  [SUPERVISOR]
  @Patch(':id/cancel')
  @Roles(UserRole.SUPERVISOR)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user,
  ) {
    const data = await this.requestsService.cancel(id, user);
    return { success: true, data };
  }

  // GET /requests/:id/history  [OPERATOR, SUPERVISOR]
  @Get(':id/history')
  @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR)
  async getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user,
  ) {
    const data = await this.requestsService.getHistory(id, user);
    return { success: true, data };
  }
}
