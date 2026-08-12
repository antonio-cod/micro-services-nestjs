import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

enum Role {
  BUYER = 'buyer',
  SELLER = 'seller',
}

export class RegisterDto {
  @ApiProperty({ description: 'Email do usuário', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Senha do usuário',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ description: 'Primeiro nome', example: 'João' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ description: 'Último nome', example: 'Silva' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({
    description: 'Role do usuário',
    example: 'buyer',
    enum: Role,
  })
  @IsEnum(Role)
  role!: Role;
}
