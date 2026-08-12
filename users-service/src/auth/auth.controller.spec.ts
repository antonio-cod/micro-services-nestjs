import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { AuthController } from './auth.controller';
import { AuthService, LoginResult, PublicUser } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.MockedFunction<AuthService['register']>;
    login: jest.MockedFunction<AuthService['login']>;
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn<AuthService['register']>(),
      login: jest.fn<AuthService['login']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get(AuthController);
  });

  it('delegates registration and returns the public user', async () => {
    const input: RegisterDto = {
      email: 'seller@example.com',
      password: 'secret123',
      firstName: 'João',
      lastName: 'Souza',
      role: UserRole.SELLER,
    };
    const registeredUser: PublicUser = {
      id: '91afac99-0cd9-4438-945e-2766594a725c',
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-08-12T12:00:00.000Z'),
      updatedAt: new Date('2026-08-12T12:00:00.000Z'),
    };
    authService.register.mockResolvedValue(registeredUser);

    await expect(controller.register(input)).resolves.toBe(registeredUser);
    expect(authService.register).toHaveBeenCalledWith(input);
  });

  it('delegates login and returns the user and token', async () => {
    const input: LoginDto = {
      email: 'seller@example.com',
      password: 'secret123',
    };
    const result: LoginResult = {
      user: {
        id: '91afac99-0cd9-4438-945e-2766594a725c',
        email: input.email,
        firstName: 'João',
        lastName: 'Souza',
        role: UserRole.SELLER,
        status: UserStatus.ACTIVE,
        createdAt: new Date('2026-08-12T12:00:00.000Z'),
        updatedAt: new Date('2026-08-12T12:00:00.000Z'),
      },
      token: 'signed.jwt.token',
    };
    authService.login.mockResolvedValue(result);

    await expect(controller.login(input)).resolves.toBe(result);
    expect(authService.login).toHaveBeenCalledWith(input);
  });
});
