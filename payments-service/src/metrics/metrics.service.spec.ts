import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('uses an isolated registry with HTTP and default Node.js metrics', async () => {
    const otherService = new MetricsService();

    service.recordHttpRequest(
      { method: 'GET', route: '/payments/:orderId', status_code: '200' },
      0.2,
    );

    const metrics = await service.getMetrics();
    const otherMetrics = await otherService.getMetrics();

    expect(metrics).toContain('# HELP http_requests_total');
    expect(metrics).toContain('# HELP http_request_duration_seconds');
    expect(metrics).toContain('# TYPE payments_processed_total counter');
    expect(metrics).toContain('# TYPE payments_approved_total counter');
    expect(metrics).toContain('# TYPE payments_rejected_total counter');
    expect(metrics).toContain('# HELP process_cpu_user_seconds_total');
    expect(metrics).toContain('route="/payments/:orderId"');
    expect(otherMetrics).not.toContain('route="/payments/:orderId"');
    expect(service.getContentType()).toContain('text/plain');
  });

  it('records approved payments as processed and approved', async () => {
    service.recordPaymentApproved();

    const metrics = await service.getMetrics();
    expect(metrics).toContain('payments_processed_total 1');
    expect(metrics).toContain('payments_approved_total 1');
    expect(metrics).not.toContain('payments_rejected_total{');
  });

  it.each([
    ['Limite excedido', 'limite_excedido'],
    ['Cartão recusado pela operadora', 'cartao_recusado_pela_operadora'],
    ['Unexpected gateway text', 'unknown'],
    [undefined, 'unknown'],
  ])('records rejection reason %p as %s', async (reason, expected) => {
    service.recordPaymentRejected(reason);

    const metrics = await service.getMetrics();
    expect(metrics).toContain('payments_processed_total 1');
    expect(metrics).toContain(
      `payments_rejected_total{reason="${expected}"} 1`,
    );
    expect(metrics).toContain('payments_approved_total 0');
  });

  it('records the counter and histogram with complete labels and buckets', async () => {
    service.recordHttpRequest(
      { method: 'GET', route: '/payments/:orderId', status_code: '200' },
      0.2,
    );

    const metrics = await service.getMetrics();
    const labels = 'method="GET",route="/payments/:orderId",status_code="200"';
    const buckets = [
      '0.005',
      '0.01',
      '0.025',
      '0.05',
      '0.1',
      '0.25',
      '0.5',
      '1',
      '2.5',
      '5',
      '10',
    ];

    expect(metrics).toContain(`http_requests_total{${labels}} 1`);
    for (const bucket of buckets) {
      expect(metrics).toContain(
        `http_request_duration_seconds_bucket{le="${bucket}",${labels}}`,
      );
    }
    expect(metrics).toContain(
      `http_request_duration_seconds_count{${labels}} 1`,
    );
  });
});
