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

const PAYMENT_REJECTION_REASONS: Readonly<Record<string, string>> = {
  'Limite excedido': 'limite_excedido',
  'Cartão recusado pela operadora': 'cartao_recusado_pela_operadora',
};

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal: Counter;
  private readonly httpRequestDurationSeconds: Histogram;
  private readonly paymentsProcessedTotal: Counter;
  private readonly paymentsApprovedTotal: Counter;
  private readonly paymentsRejectedTotal: Counter<'reason'>;

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

    this.paymentsProcessedTotal = new Counter({
      name: 'payments_processed_total',
      help: 'Total number of payments persisted in a terminal state',
      registers: [this.registry],
    });

    this.paymentsApprovedTotal = new Counter({
      name: 'payments_approved_total',
      help: 'Total number of approved payments persisted',
      registers: [this.registry],
    });

    this.paymentsRejectedTotal = new Counter({
      name: 'payments_rejected_total',
      help: 'Total number of rejected payments persisted by stable reason',
      labelNames: ['reason'] as const,
      registers: [this.registry],
    });
  }

  recordHttpRequest(labels: HttpMetricLabels, durationSeconds: number): void {
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  recordPaymentApproved(): void {
    this.paymentsProcessedTotal.inc();
    this.paymentsApprovedTotal.inc();
  }

  recordPaymentRejected(reason?: string | null): void {
    const normalizedReason =
      (reason && PAYMENT_REJECTION_REASONS[reason]) || 'unknown';
    this.paymentsProcessedTotal.inc();
    this.paymentsRejectedTotal.inc({ reason: normalizedReason });
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
