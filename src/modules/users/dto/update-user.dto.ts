import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { UserRole } from '../../../entities/enums';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
