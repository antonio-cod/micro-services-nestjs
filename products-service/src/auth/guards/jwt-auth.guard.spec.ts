import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAuthGuard, PassportJwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const handler = jest.fn();
  class TestController {}

  const context = {
    getHandler: () => handler,
    getClass: () => TestController,
  } as unknown as ExecutionContext;

  afterEach(() => jest.restoreAllMocks());

  it('allows a public resource without invoking Passport', () => {
    const getAllAndOverride = jest.fn().mockReturnValue(true);
    const reflector = { getAllAndOverride } as unknown as Reflector;
    const passportGuard = jest.spyOn(
      PassportJwtAuthGuard.prototype,
      'canActivate',
    );

    expect(new JwtAuthGuard(reflector).canActivate(context)).toBe(true);
    expect(getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      handler,
      TestController,
    ]);
    expect(passportGuard).not.toHaveBeenCalled();
  });

  it('delegates a protected resource to Passport', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const passportGuard = jest
      .spyOn(PassportJwtAuthGuard.prototype, 'canActivate')
      .mockReturnValue(true);

    expect(new JwtAuthGuard(reflector).canActivate(context)).toBe(true);
    expect(passportGuard).toHaveBeenCalledWith(context);
  });
});
