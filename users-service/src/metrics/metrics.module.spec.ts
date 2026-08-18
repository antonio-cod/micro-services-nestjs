import {
  GLOBAL_MODULE_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppModule } from '../app.module';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsController } from './metrics.controller';
import { MetricsModule } from './metrics.module';
import { MetricsService } from './metrics.service';

describe('MetricsModule', () => {
  it('is global and declares its controller, export and interceptor', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      MetricsModule,
    ) as unknown[];
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      MetricsModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      MetricsModule,
    ) as unknown[];

    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, MetricsModule)).toBe(
      true,
    );
    expect(controllers).toContain(MetricsController);
    expect(exports).toContain(MetricsService);
    expect(providers).toContainEqual({
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    });
  });

  it('is imported exactly once by AppModule', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      AppModule,
    ) as unknown[];

    expect(imports.filter((module) => module === MetricsModule)).toHaveLength(
      1,
    );
  });
});
