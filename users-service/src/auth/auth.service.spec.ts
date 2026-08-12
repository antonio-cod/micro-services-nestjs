import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { compare, getRounds } from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

type RepositoryMock = Pick<Repository<User>, 'findOneBy' | 'create' | 'save'>;
type JwtServiceMock = Pick<JwtService, 'signAsync'>;

describe('AuthService', () => {
  let service: AuthService;
  let repository: jest.Mocked<RepositoryMock>;
  let jwtService: jest.Mocked<JwtServiceMock>;

  const registerDto: RegisterDto = {
    email: 'buyer@example.com',
    password: 'secret123',
    firstName: 'Maria',
    lastName: 'Silva',
    role: UserRole.BUYER,
  };

  beforeEach(async () => {
    repository = {
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    jwtService = { signAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: repository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('creates an active user with a bcrypt hash and omits password', async () => {
    repository.findOneBy.mockResolvedValue(null);
    repository.create.mockImplementation((input) => input as User);
    repository.save.mockImplementation((user) =>
      Promise.resolve({
        ...user,
        id: '0d7cff68-7c3b-44f4-9689-6ec74293fc88',
        createdAt: new Date('2026-08-12T12:00:00.000Z'),
        updatedAt: new Date('2026-08-12T12:00:00.000Z'),
      }),
    );

    const result = await service.register(registerDto);
    const persistedUser = repository.create.mock.calls[0][0];

    expect(persistedUser.status).toBe(UserStatus.ACTIVE);
    expect(persistedUser.password).not.toBe(registerDto.password);
    await expect(
      compare(registerDto.password, persistedUser.password as string),
    ).resolves.toBe(true);
    expect(getRounds(persistedUser.password as string)).toBe(10);
    expect(result).not.toHaveProperty('password');
    expect(result).toMatchObject({
      email: registerDto.email,
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
    });
  });

  it('rejects an email found before persistence', async () => {
    repository.findOneBy.mockResolvedValue({
      email: registerDto.email,
    } as User);

    await expect(service.register(registerDto)).rejects.toThrow(
      new ConflictException('Email já cadastrado'),
    );
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('maps a concurrent unique constraint violation to conflict', async () => {
    repository.findOneBy.mockResolvedValue(null);
    repository.create.mockImplementation((input) => input as User);
    repository.save.mockRejectedValue({ code: '23505', detail: 'internal' });

    await expect(service.register(registerDto)).rejects.toThrow(
      new ConflictException('Email já cadastrado'),
    );
  });

  it('does not hide unexpected persistence errors', async () => {
    const databaseError = new Error('database unavailable');
    repository.findOneBy.mockResolvedValue(null);
    repository.create.mockImplementation((input) => input as User);
    repository.save.mockRejectedValue(databaseError);

    await expect(service.register(registerDto)).rejects.toBe(databaseError);
  });

  describe('login', () => {
    const password = 'secret123';
    const activeUser = {
      id: '0d7cff68-7c3b-44f4-9689-6ec74293fc88',
      email: registerDto.email,
      password: '$2b$10$ioMfBfwQsl5G5oHad7JjgOE/NoS9v2Uy.K62z.l2QjTcRJaje8XPC',
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-08-12T12:00:00.000Z'),
      updatedAt: new Date('2026-08-12T12:00:00.000Z'),
    } as User;

    it('authenticates an active user and signs only public claims', async () => {
      repository.findOneBy.mockResolvedValue(activeUser);
      jwtService.signAsync.mockResolvedValue('signed.jwt.token');

      const result = await service.login({ email: activeUser.email, password });

      expect(repository.findOneBy).toHaveBeenCalledWith({
        email: activeUser.email,
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: activeUser.id,
        email: activeUser.email,
        role: activeUser.role,
      });
      expect(result).toEqual({
        user: {
          id: activeUser.id,
          email: activeUser.email,
          firstName: activeUser.firstName,
          lastName: activeUser.lastName,
          role: activeUser.role,
          status: activeUser.status,
          createdAt: activeUser.createdAt,
          updatedAt: activeUser.updatedAt,
        },
        token: 'signed.jwt.token',
      });
      expect(result.user).not.toHaveProperty('password');
    });

    it('returns the same error for an unknown email and a wrong password', async () => {
      repository.findOneBy.mockResolvedValueOnce(null);
      await expect(
        service.login({ email: 'unknown@example.com', password }),
      ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));

      repository.findOneBy.mockResolvedValueOnce(activeUser);
      await expect(
        service.login({ email: activeUser.email, password: 'wrong-password' }),
      ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('rejects an inactive account only after validating its password', async () => {
      repository.findOneBy.mockResolvedValue({
        ...activeUser,
        status: UserStatus.INACTIVE,
      });

      await expect(
        service.login({ email: activeUser.email, password }),
      ).rejects.toThrow(new UnauthorizedException('Conta inativa'));
      await expect(
        service.login({ email: activeUser.email, password: 'wrong-password' }),
      ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });
});
