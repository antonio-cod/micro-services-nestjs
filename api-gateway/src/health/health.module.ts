import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HealthCheckModule } from '../common/health/health-check.module';
import { HttpModule } from '@nestjs/axios';
import { TerminusModule } from '@nestjs/terminus';

@Module({
  imports: [
    HealthCheckModule,
    TerminusModule,
    HttpModule.register({ timeout: 3_000 }),
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
