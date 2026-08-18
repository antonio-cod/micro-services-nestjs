import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

export type HttpMetricLabels = Record<
  'method' | 'route' | 'status_code',
  string
>;
export type RabbitMqQueue = 'payment_queue';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal: Counter;
  private readonly httpRequestDurationSeconds: Histogram;
  private readonly ordersCreatedTotal: Counter;
  private readonly rabbitMqMessagesPublishedTotal: Counter<'queue'>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of completed HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.ordersCreatedTotal = new Counter({
      name: 'orders_created_total',
      help: 'Total number of orders persisted by completed transactions',
      registers: [this.registry],
    });

    this.rabbitMqMessagesPublishedTotal = new Counter({
      name: 'rabbitmq_messages_published_total',
      help: 'Total number of successfully published RabbitMQ messages by queue',
      labelNames: ['queue'] as const,
      registers: [this.registry],
    });
  }

  recordHttpRequest(labels: HttpMetricLabels, durationSeconds: number): void {
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  recordOrderCreated(): void {
    this.ordersCreatedTotal.inc();
  }

  recordRabbitMqMessagePublished(queue: RabbitMqQueue): void {
    this.rabbitMqMessagesPublishedTotal.inc({ queue });
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
