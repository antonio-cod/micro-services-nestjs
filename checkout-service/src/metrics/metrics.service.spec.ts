import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('uses an isolated registry with HTTP and default Node.js metrics', async () => {
    const otherService = new MetricsService();

    service.recordHttpRequest(
      { method: 'GET', route: '/orders/:id', status_code: '200' },
      0.2,
    );

    const metrics = await service.getMetrics();
    const otherMetrics = await otherService.getMetrics();

    expect(metrics).toContain('# HELP http_requests_total');
    expect(metrics).toContain('# HELP http_request_duration_seconds');
    expect(metrics).toContain('# HELP process_cpu_user_seconds_total');
    expect(metrics).toContain('route="/orders/:id"');
    expect(otherMetrics).not.toContain('route="/orders/:id"');
    expect(service.getContentType()).toContain('text/plain');
  });

  it('records the counter and histogram with complete labels and buckets', async () => {
    service.recordHttpRequest(
      { method: 'GET', route: '/orders/:id', status_code: '200' },
      0.2,
    );

    const metrics = await service.getMetrics();
    const labels = 'method="GET",route="/orders/:id",status_code="200"';

    expect(metrics).toContain(`http_requests_total{${labels}} 1`);
    expect(metrics).toContain(
      `http_request_duration_seconds_bucket{le="0.25",${labels}} 1`,
    );
    expect(metrics).toContain(
      `http_request_duration_seconds_bucket{le="10",${labels}} 1`,
    );
    expect(metrics).toContain(
      `http_request_duration_seconds_count{${labels}} 1`,
    );
  });
});
