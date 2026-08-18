import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  GLOBAL_MODULE_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';
import { AppModule } from '../app.module';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsModule } from './metrics.module';
import { MetricsService } from './metrics.service';

describe('MetricsModule', () => {
  it('is global, exports the service and registers the global interceptor', () => {
    const providers: unknown[] = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      MetricsModule,
    );
    const exports: unknown[] = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      MetricsModule,
    );

    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, MetricsModule)).toBe(
      true,
    );
    expect(exports).toContain(MetricsService);
    expect(providers).toContainEqual({
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    });
  });

  it('is imported exactly once by AppModule', () => {
    const imports: unknown[] = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      AppModule,
    );

    expect(imports.filter((module) => module === MetricsModule)).toHaveLength(
      1,
    );
  });
});
