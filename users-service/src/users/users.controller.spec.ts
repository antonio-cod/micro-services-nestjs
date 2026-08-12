import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UserRole } from './enums/user-role.enum';
import { UsersController } from './users.controller';
import { PublicUser, UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    findProfile: jest.MockedFunction<UsersService['findProfile']>;
    findActiveSellers: jest.MockedFunction<UsersService['findActiveSellers']>;
    findById: jest.MockedFunction<UsersService['findById']>;
  };

  beforeEach(async () => {
    usersService = {
      findProfile: jest.fn<UsersService['findProfile']>(),
      findActiveSellers: jest.fn<UsersService['findActiveSellers']>(),
      findById: jest.fn<UsersService['findById']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get(UsersController);
  });

  it('defines the users controller and the three GET routes', () => {
    expect(Reflect.getMetadata(PATH_METADATA, UsersController)).toBe('users');

    for (const [methodName, path] of [
      ['profile', 'profile'],
      ['sellers', 'sellers'],
      ['findById', ':id'],
    ] as const) {
      const handler = Object.getOwnPropertyDescriptor(
        UsersController.prototype,
        methodName,
      )?.value as unknown;

      expect(handler).toEqual(expect.any(Function));
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
        RequestMethod.GET,
      );
    }
  });

  it('uses only the authenticated user id to load the profile', async () => {
    const authenticatedUser: AuthenticatedUser = {
      id: '91afac99-0cd9-4438-945e-2766594a725c',
      email: 'stale@example.com',
      role: UserRole.BUYER,
    };
    const profile = { id: authenticatedUser.id } as PublicUser;
    usersService.findProfile.mockResolvedValue(profile);

    await expect(
      controller.profile({ user: authenticatedUser } as never),
    ).resolves.toBe(profile);
    expect(usersService.findProfile).toHaveBeenCalledWith(authenticatedUser.id);
  });

  it('delegates the active seller listing', async () => {
    usersService.findActiveSellers.mockResolvedValue([]);

    await expect(controller.sellers()).resolves.toEqual([]);
    expect(usersService.findActiveSellers).toHaveBeenCalledWith();
  });

  it('delegates lookup by id', async () => {
    const id = '0d7cff68-7c3b-44f4-9689-6ec74293fc88';
    const found = { id } as PublicUser;
    usersService.findById.mockResolvedValue(found);

    await expect(controller.findById(id)).resolves.toBe(found);
    expect(usersService.findById).toHaveBeenCalledWith(id);
  });
});
