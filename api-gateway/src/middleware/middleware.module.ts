import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggingMiddleware } from './looging/looging.middleware';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
  ],
  providers: [LoggingMiddleware],
})
export class MiddlewareModule {}
