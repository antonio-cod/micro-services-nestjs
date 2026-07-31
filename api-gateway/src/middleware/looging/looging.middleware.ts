import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: () => void) {
    const { method, originalUrl, ip } = req;
    const userAget = req.get('User-Agent') || '';
    const startTime = Date.now();

    this.logger.log(
      `Incomming Request: ${method} ${originalUrl} - IP: ${ip} - User-Agent: $
      {userAget}`,
    );

    res.on('finifh', () => {
      const { statusCode } = res;
      const contentLength = res.get('Context-Length');
      const duration = Date.now() - startTime;

      this.logger.log(
        `Outgoing Response: ${method} ${originalUrl} - ${statusCode} - ${contentLength || 0}b - ${duration}ms`,
      );

      if (statusCode >= 400) {
        this.logger.error(
          `Error Response: ${method} ${originalUrl} - ${statusCode} - ${duration}ms`,
        );
      }
    });

    // Log de erros
    res.on('error', (error) => {
      this.logger.error(
        `Response Error: ${method} ${originalUrl} - ${error.message}`,
      );
    });

    // Log de timeout
    req.on('timeout', () => {
      this.logger.warn(
        `Request Timeout: ${method} ${originalUrl} - ${Date.now() - startTime}ms`,
      );
    });

    next();
  }
}
