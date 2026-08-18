import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

type RequestWithRoute = {
  method: string;
  originalUrl?: string;
  url: string;
  baseUrl?: string;
  route?: { path?: unknown };
};

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithRoute>();
    const response = http.getResponse<Response>();

    if (this.getPathname(request.originalUrl ?? request.url) === '/metrics') {
      return next.handle();
    }

    const startedAt = process.hrtime.bigint();
    let errorStatus: number | undefined;

    return next.handle().pipe(
      tap({
        error: (error: unknown) => {
          errorStatus =
            error instanceof HttpException ? error.getStatus() : 500;
        },
        finalize: () => {
          const durationSeconds =
            Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

          this.metricsService.recordHttpRequest(
            {
              method: request.method.toUpperCase(),
              route: this.getRouteTemplate(request),
              status_code: String(errorStatus ?? response.statusCode),
            },
            durationSeconds,
          );
        },
      }),
    );
  }

  private getPathname(url: string): string {
    return url.split('?', 1)[0];
  }

  private getRouteTemplate(request: RequestWithRoute): string {
    const routePath = request.route?.path;
    if (typeof routePath !== 'string') {
      return 'unknown';
    }

    const baseUrl = request.baseUrl ?? '';
    if (
      !baseUrl ||
      routePath === baseUrl ||
      routePath.startsWith(`${baseUrl}/`)
    ) {
      return this.normalizeRoute(routePath);
    }

    return this.normalizeRoute(`${baseUrl}/${routePath}`);
  }

  private normalizeRoute(route: string): string {
    const normalized = `/${route}`.replace(/\/+/g, '/');
    return normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
  }
}
