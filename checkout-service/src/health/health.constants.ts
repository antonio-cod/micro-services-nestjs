import type { RmqOptions } from '@nestjs/microservices';
import type { MicroserviceHealthIndicatorOptions } from '@nestjs/terminus';

export const HEALTH_RABBITMQ_OPTIONS = Symbol('HEALTH_RABBITMQ_OPTIONS');

export type HealthRabbitMqOptions =
  MicroserviceHealthIndicatorOptions<RmqOptions>;
