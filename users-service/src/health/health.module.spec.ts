import { MODULE_METADATA } from '@nestjs/common/constants';
import { TerminusModule } from '@nestjs/terminus';
import { AppModule } from '../app.module';
import { HealthController } from './health.controller';
import { HealthModule } from './health.module';

describe('HealthModule', () => {
  it('registers Terminus and the health controller', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, HealthModule)).toEqual([
      TerminusModule,
    ]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, HealthModule),
    ).toEqual([HealthController]);
  });

  it('is imported exactly once by AppModule', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      AppModule,
    ) as unknown[];

    expect(imports.filter((item) => item === HealthModule)).toHaveLength(1);
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AppModule),
    ).not.toContain(HealthController);
  });
});
