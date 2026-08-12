import { ConflictException } from '@nestjs/common';
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

describe('AuthService', () => {
  let service: AuthService;
  let repository: jest.Mocked<RepositoryMock>;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: repository },
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
});
