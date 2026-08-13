import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'Verifica a disponibilidade do serviço' })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', service: 'products-service' },
    },
  })
  check() {
    return { status: 'ok', service: 'products-service' } as const;
  }
}
