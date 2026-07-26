import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface ThrottlerRequest {
  ip?: string;
  headers?: {
    'user-agent'?: string;
  };
}

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const request = req as ThrottlerRequest;

    const ip = request.ip ?? 'unknown';
    const userAgent = request.headers?.['user-agent'] ?? 'unknown';

    return Promise.resolve(`${ip}-${userAgent}`);
  }
}
