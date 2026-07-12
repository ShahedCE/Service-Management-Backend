import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../../entities/enums';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // POST /users  [SUPERVISOR only]
  @Post()
  @Roles(UserRole.SUPERVISOR)
  async create(@Body() dto: CreateUserDto) {
    const data = await this.usersService.create(dto);
    return { success: true, data };
  }

  // GET /users  [SUPERVISOR only]
  @Get()
  @Roles(UserRole.SUPERVISOR)
  async findAll() {
    const data = await this.usersService.findAll();
    return { success: true, data };
  }

  // GET /users/:id  [SUPERVISOR only]
  @Get(':id')
  @Roles(UserRole.SUPERVISOR)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.usersService.findOne(id);
    return { success: true, data };
  }

  // PATCH /users/:id  [SUPERVISOR only]
  @Patch(':id')
  @Roles(UserRole.SUPERVISOR)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const data = await this.usersService.update(id, dto);
    return { success: true, data };
  }
}
