import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../users/enums/user-role.enum';

export class RegisterDto {
  @IsNotEmpty({ message: 'email é obrigatório' })
  @IsEmail({}, { message: 'email deve ser um endereço de email válido' })
  email!: string;

  @IsString({ message: 'password deve ser uma string' })
  @IsNotEmpty({ message: 'password é obrigatório' })
  @MinLength(6, { message: 'password deve ter no mínimo 6 caracteres' })
  password!: string;

  @IsString({ message: 'firstName deve ser uma string' })
  @IsNotEmpty({ message: 'firstName é obrigatório' })
  @MaxLength(100, {
    message: 'firstName deve ter no máximo 100 caracteres',
  })
  firstName!: string;

  @IsString({ message: 'lastName deve ser uma string' })
  @IsNotEmpty({ message: 'lastName é obrigatório' })
  @MaxLength(100, {
    message: 'lastName deve ter no máximo 100 caracteres',
  })
  lastName!: string;

  @IsNotEmpty({ message: 'role é obrigatório' })
  @IsEnum(UserRole, { message: 'role deve ser seller ou buyer' })
  role!: UserRole;
}
