import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('uses an isolated registry with HTTP and default Node.js metrics', async () => {
    const otherService = new MetricsService();

    service.recordHttpRequest(
      { method: 'GET', route: '/users/:id', status_code: '200' },
      0.2,
    );

    const metrics = await service.getMetrics();
    const otherMetrics = await otherService.getMetrics();

    expect(metrics).toContain('# HELP http_requests_total');
    expect(metrics).toContain('# HELP http_request_duration_seconds');
    expect(metrics).toContain('# HELP process_cpu_user_seconds_total');
    expect(metrics).toContain('route="/users/:id"');
    expect(otherMetrics).not.toContain('route="/users/:id"');
    expect(service.getContentType()).toContain('text/plain');
  });

  it('records the counter and histogram with complete labels and all buckets', async () => {
    service.recordHttpRequest(
      { method: 'GET', route: '/users/:id', status_code: '200' },
      0.2,
    );

    const metrics = await service.getMetrics();
    const labels = 'method="GET",route="/users/:id",status_code="200"';
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
