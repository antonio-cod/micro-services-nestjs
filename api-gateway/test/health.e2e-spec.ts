import { HttpService } from '@nestjs/axios';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

process.env.JWT_SECRET = 'gateway-health-e2e-jwt-secret';

describe('gateway downstream health (e2e)', () => {
  let app: INestApplication<App>;
  const failures = new Map<string, '503' | 'timeout'>();
  const httpService = {
    get: jest.fn(() => of({ status: 200 } as AxiosResponse)),
    request: jest.fn((config: { url: string }) => {
      const failure = [...failures.entries()].find(([service]) =>
        config.url.includes(service),
      )?.[1];

      if (failure === '503') {
        return throwError(
          () =>
            new AxiosError(
              'Request failed with status code 503',
              'ERR_BAD_RESPONSE',
              undefined,
              undefined,
              {
                status: 503,
                statusText: 'Service Unavailable',
              } as AxiosResponse,
            ),
        );
      }
      if (failure === 'timeout') {
        return throwError(
          () => new AxiosError('timeout of 3000ms exceeded', 'ECONNABORTED'),
        );
      }

      return of({ status: 200, statusText: 'OK' } as AxiosResponse);
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue(httpService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    failures.clear();
    httpService.request.mockClear();
  });

  it('returns 200 with four healthy indicators', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.details).toEqual({
      'users-service': { status: 'up' },
      'products-service': { status: 'up' },
      'checkout-service': { status: 'up' },
      'payments-service': { status: 'up' },
    });
    expect(httpService.request).toHaveBeenCalledTimes(4);
  });

  it('returns 503 and identifies a failed indicator without leaking its URL', async () => {
    failures.set(':3001', '503');

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);

    expect(response.body.status).toBe('error');
    expect(response.body.error['products-service']).toMatchObject({
      status: 'down',
    });
    expect(response.body.details['users-service']).toEqual({ status: 'up' });
    expect(JSON.stringify(response.body)).not.toContain('http://');
    expect(JSON.stringify(response.body)).not.toContain('stack');
    expect(httpService.request).toHaveBeenCalledTimes(4);
  });

  it('returns 503 when a downstream times out', async () => {
    failures.set(':3003', 'timeout');

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);

    expect(response.body.error['checkout-service']).toMatchObject({
      status: 'down',
    });
    expect(httpService.request).toHaveBeenCalledTimes(4);
  });

  it('reports simultaneous failures while retaining successful checks', async () => {
    failures.set(':3000', '503');
    failures.set(':3004', 'timeout');

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);

    expect(Object.keys(response.body.error)).toEqual([
      'users-service',
      'payments-service',
    ]);
    expect(response.body.info).toEqual({
      'products-service': { status: 'up' },
      'checkout-service': { status: 'up' },
    });
    expect(httpService.request).toHaveBeenCalledTimes(4);
  });

  afterAll(async () => {
    await app?.close();
  });
});
