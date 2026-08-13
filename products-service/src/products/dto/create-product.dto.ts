import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString({ message: 'name deve ser uma string' })
  @IsNotEmpty({ message: 'name é obrigatório' })
  @MaxLength(255, { message: 'name deve ter no máximo 255 caracteres' })
  name!: string;

  @IsString({ message: 'description deve ser uma string' })
  @IsNotEmpty({ message: 'description é obrigatório' })
  description!: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'price deve ser um número com no máximo 2 casas decimais' },
  )
  @Min(0.01, { message: 'price deve ser no mínimo 0.01' })
  price!: number;

  @IsInt({ message: 'stock deve ser um número inteiro' })
  @Min(0, { message: 'stock deve ser no mínimo 0' })
  stock!: number;
}
