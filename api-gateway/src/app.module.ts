import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProxyModule } from './proxy/proxy.module';
// import { ProxyService } from './proxy/service/proxy.service';
import { MiddlewareModule } from './middleware/middleware.module';
import { LoggingMiddleware } from './middleware/looging/looging.middleware';
import { AuthModule } from './auth/auth.module';
import { CustomThrottlerGuard } from './guards/throttler.guard';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { CircuitBreakerModule } from './common/circuit-breaker/circuit-breaker.module';
import { FallbackModule } from './common/fallback/fallback.module';
import { TimeoutModule } from './common/timeout/timeout.module';
import { RetryModule } from './common/retry/retry.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CheckoutModule } from './checkout/checkout.module';
import { PaymentsModule } from './payments/payments.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          name: 'short',
          ttl: 1000,
          limit: configService.get<number>('RATE_LIMIT_SHORT', 10),
        },
        {
          name: 'medium',
          ttl: 60000,
          limit: configService.get<number>('RATE_LIMIT_MEDIUM', 100),
        },
        {
          name: 'long',
          ttl: 900000,
          limit: configService.get<number>('RATE_LIMIT_LONG', 1000),
        },
      ],
      inject: [ConfigService],
    }),
    ProxyModule,
    MiddlewareModule,
    AuthModule,
    HealthModule,
    FallbackModule,
    CircuitBreakerModule,
    TimeoutModule,
    RetryModule,
    UsersModule,
    ProductsModule,
    CheckoutModule,
    PaymentsModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
  // exports: [ProxyService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
