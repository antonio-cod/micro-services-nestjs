import { Controller, Get } from '@nestjs/common';
import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('@Public()', () => {
  it('sets public metadata on a route', () => {
    class TestController {
      @Public()
      route() {}
    }

    const handler = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'route',
    )?.value as object;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
  });

  it('sets public metadata on a controller', () => {
    @Public()
    @Controller('public')
    class PublicController {
      @Get()
      route() {}
    }

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PublicController)).toBe(true);
  });
});
