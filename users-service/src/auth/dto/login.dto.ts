import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'email deve ser uma string' })
  @IsNotEmpty({ message: 'email é obrigatório' })
  @IsEmail({}, { message: 'email deve ser um endereço de email válido' })
  email!: string;

  @IsString({ message: 'password deve ser uma string' })
  @IsNotEmpty({ message: 'password é obrigatório' })
  @MinLength(6, { message: 'password deve ter no mínimo 6 caracteres' })
  password!: string;
}
