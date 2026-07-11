import { IsOptional, IsString } from 'class-validator';

export class UpdateRequestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Note: "status" is intentionally excluded.
  // Status can only change via approve/reject/cancel endpoints.
}
