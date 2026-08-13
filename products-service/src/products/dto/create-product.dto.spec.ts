import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

describe('CreateProductDto', () => {
  const validInput = {
    name: 'Teclado mecânico',
    description: 'Teclado com switches táteis',
    price: 199.9,
    stock: 10,
  };

  async function errorsFor(input: object) {
    return validate(plainToInstance(CreateProductDto, input));
  }

  it.each([
    validInput,
    { ...validInput, price: 0.01, stock: 0 },
    { ...validInput, price: 100 },
  ])('accepts a valid product %#', async (input) => {
    await expect(errorsFor(input)).resolves.toHaveLength(0);
  });

  it.each([
    ['name', { ...validInput, name: undefined }],
    ['name', { ...validInput, name: null }],
    ['name', { ...validInput, name: '' }],
    ['name', { ...validInput, name: 'a'.repeat(256) }],
    ['description', { ...validInput, description: undefined }],
    ['description', { ...validInput, description: null }],
    ['description', { ...validInput, description: '' }],
    ['price', { ...validInput, price: undefined }],
    ['price', { ...validInput, price: null }],
    ['price', { ...validInput, price: '10.00' }],
    ['price', { ...validInput, price: 0 }],
    ['price', { ...validInput, price: 10.001 }],
    ['stock', { ...validInput, stock: undefined }],
    ['stock', { ...validInput, stock: null }],
    ['stock', { ...validInput, stock: -1 }],
    ['stock', { ...validInput, stock: 1.5 }],
  ])('rejects an invalid %s', async (property, input) => {
    const errors = await errorsFor(input);

    expect(errors.some((error) => error.property === property)).toBe(true);
  });
});
