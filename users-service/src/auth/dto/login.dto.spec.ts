import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  const validInput = {
    email: 'buyer@example.com',
    password: 'secret123',
  };

  const validateInput = (input: Record<string, unknown>) =>
    validate(plainToInstance(LoginDto, input), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

  it('accepts valid credentials', async () => {
    await expect(validateInput(validInput)).resolves.toHaveLength(0);
  });

  it.each([
    ['email missing', { password: validInput.password }, 'email'],
    ['password missing', { email: validInput.email }, 'password'],
    ['null email', { ...validInput, email: null }, 'email'],
    ['empty password', { ...validInput, password: '' }, 'password'],
    ['numeric email', { ...validInput, email: 123 }, 'email'],
    ['numeric password', { ...validInput, password: 123456 }, 'password'],
    ['invalid email', { ...validInput, email: 'invalid' }, 'email'],
    ['short password', { ...validInput, password: '12345' }, 'password'],
    ['extra field', { ...validInput, role: 'buyer' }, 'role'],
  ])('rejects %s', async (_scenario, input, property) => {
    const errors = await validateInput(input);
    expect(errors.some((error) => error.property === property)).toBe(true);
  });
});
