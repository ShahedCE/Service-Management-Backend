import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  @IsNotEmpty()
  operatorId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
}
