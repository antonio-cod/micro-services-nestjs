import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('@Public()', () => {
  it('marks a controller as public', () => {
    @Public()
    class PublicController {}

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PublicController)).toBe(true);
  });

  it('marks a route handler as public', () => {
    class TestController {
      @Public()
      handler(this: void): void {}
    }

    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, TestController.prototype.handler),
    ).toBe(true);
  });
});
