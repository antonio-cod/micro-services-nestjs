import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'healthy' } {
    return { status: 'healthy' };
  }
}
