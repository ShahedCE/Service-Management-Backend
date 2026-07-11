import { IsNotEmpty, IsString, IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '../../../entities/enums';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEnum(UserRole)
  role: UserRole;
}
