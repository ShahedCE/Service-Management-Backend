import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { RequestPriority } from '../../../entities/enums';

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(RequestPriority)
  priority: RequestPriority;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}
