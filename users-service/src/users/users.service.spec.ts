import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';
import { UsersService } from './users.service';

type RepositoryMock = Pick<Repository<User>, 'findOneBy' | 'findBy'>;

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<RepositoryMock>;

  const user: User = {
    id: '91afac99-0cd9-4438-945e-2766594a725c',
    email: 'seller@example.com',
    password: 'private-hash',
    firstName: 'Maria',
    lastName: 'Silva',
    role: UserRole.SELLER,
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-08-12T12:00:00.000Z'),
    updatedAt: new Date('2026-08-12T13:00:00.000Z'),
  };

  beforeEach(async () => {
    repository = {
      findOneBy: jest.fn(),
      findBy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repository },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('returns the current persisted profile without password', async () => {
    repository.findOneBy.mockResolvedValue(user);

    const result = await service.findProfile(user.id);

    expect(repository.findOneBy).toHaveBeenCalledWith({ id: user.id });
    expect(result).toEqual({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
    expect(result).not.toHaveProperty('password');
  });

  it('rejects a profile whose authenticated user no longer exists', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findProfile(user.id)).rejects.toThrow(
      new UnauthorizedException('Usuário autenticado não encontrado'),
    );
  });

  it('returns only active sellers and removes every password', async () => {
    repository.findBy.mockResolvedValue([
      user,
      { ...user, id: '0d7cff68-7c3b-44f4-9689-6ec74293fc88' },
    ]);

    const result = await service.findActiveSellers();

    expect(repository.findBy).toHaveBeenCalledWith({
      role: UserRole.SELLER,
      status: UserStatus.ACTIVE,
    });
    expect(result).toHaveLength(2);
    expect(result.every((item) => !('password' in item))).toBe(true);
  });

  it('returns an empty seller list unchanged', async () => {
    repository.findBy.mockResolvedValue([]);

    await expect(service.findActiveSellers()).resolves.toEqual([]);
  });

  it('returns any user by id without password', async () => {
    const inactiveBuyer = {
      ...user,
      role: UserRole.BUYER,
      status: UserStatus.INACTIVE,
    };
    repository.findOneBy.mockResolvedValue(inactiveBuyer);

    const result = await service.findById(inactiveBuyer.id);

    expect(repository.findOneBy).toHaveBeenCalledWith({ id: inactiveBuyer.id });
    expect(result).toMatchObject({
      id: inactiveBuyer.id,
      role: UserRole.BUYER,
      status: UserStatus.INACTIVE,
    });
    expect(result).not.toHaveProperty('password');
  });

  it('returns not found for an unknown user id', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findById(user.id)).rejects.toThrow(
      new NotFoundException('Usuário não encontrado'),
    );
  });
});
