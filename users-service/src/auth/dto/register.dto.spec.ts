import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserRole } from '../../users/enums/user-role.enum';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  const validInput = {
    email: 'buyer@example.com',
    password: 'secret123',
    firstName: 'Maria',
    lastName: 'Silva',
    role: UserRole.BUYER,
  };

  const validateInput = (input: Record<string, unknown>) =>
    validate(plainToInstance(RegisterDto, input));

  it('accepts a valid registration', async () => {
    await expect(validateInput(validInput)).resolves.toHaveLength(0);
  });

  it.each([
    ['email', { ...validInput, email: undefined }],
    ['password', { ...validInput, password: undefined }],
    ['firstName', { ...validInput, firstName: undefined }],
    ['lastName', { ...validInput, lastName: undefined }],
    ['role', { ...validInput, role: undefined }],
  ])('rejects a missing %s', async (property, input) => {
    const errors = await validateInput(input);
    expect(errors.some((error) => error.property === property)).toBe(true);
  });

  it.each([
    ['email', { ...validInput, email: 'not-an-email' }],
    ['password', { ...validInput, password: '12345' }],
    ['firstName', { ...validInput, firstName: 'a'.repeat(101) }],
    ['lastName', { ...validInput, lastName: 'a'.repeat(101) }],
    ['role', { ...validInput, role: 'admin' }],
  ])('rejects an invalid %s', async (property, input) => {
    const errors = await validateInput(input);
    expect(errors.some((error) => error.property === property)).toBe(true);
  });

  it('reports errors for every invalid property', async () => {
    const errors = await validateInput({
      email: 'invalid',
      password: '123',
      firstName: 'a'.repeat(101),
      lastName: 'a'.repeat(101),
      role: 'admin',
    });

    expect(errors.map((error) => error.property).sort()).toEqual([
      'email',
      'firstName',
      'lastName',
      'password',
      'role',
    ]);
  });
});
