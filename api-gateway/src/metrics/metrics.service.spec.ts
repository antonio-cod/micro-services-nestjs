import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('exposes the HTTP and default Node.js metric families', async () => {
    const metrics = await service.getMetrics();

    expect(metrics).toContain('# HELP http_requests_total');
    expect(metrics).toContain('# HELP http_request_duration_seconds');
    expect(metrics).toContain('# HELP process_cpu_user_seconds_total');
    expect(service.getContentType()).toContain('text/plain');
  });

  it('records the counter and histogram with complete labels and buckets', async () => {
    service.recordHttpRequest(
      { method: 'GET', route: '/products/:id', status_code: '200' },
      0.2,
    );

    const metrics = await service.getMetrics();
    const labels = 'method="GET",route="/products/:id",status_code="200"';

    expect(metrics).toContain(`http_requests_total{${labels}} 1`);
    expect(metrics).toContain(
      `http_request_duration_seconds_bucket{le="0.25",${labels}} 1`,
    );
    expect(metrics).toContain(
      `http_request_duration_seconds_count{${labels}} 1`,
    );
  });
});
