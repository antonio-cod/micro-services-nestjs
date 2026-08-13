import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard, PassportJwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const context = {
    getHandler: jest.fn().mockReturnValue(class Handler {}),
    getClass: jest.fn().mockReturnValue(class Controller {}),
  } as unknown as ExecutionContext;

  it('allows a public resource without invoking Passport', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const passportSpy = jest.spyOn(
      PassportJwtAuthGuard.prototype,
      'canActivate',
    );

    expect(new JwtAuthGuard(reflector).canActivate(context)).toBe(true);
    expect(passportSpy).not.toHaveBeenCalled();
    passportSpy.mockRestore();
  });

  it('delegates a protected resource to Passport', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const passportSpy = jest
      .spyOn(PassportJwtAuthGuard.prototype, 'canActivate')
      .mockReturnValue(true);

    expect(new JwtAuthGuard(reflector).canActivate(context)).toBe(true);
    expect(passportSpy).toHaveBeenCalledWith(context);
    passportSpy.mockRestore();
  });
});
