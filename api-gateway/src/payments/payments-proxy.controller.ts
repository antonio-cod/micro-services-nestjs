import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../guards/auth.guard';
import { ProxyService } from '../proxy/service/proxy.service';

interface GatewayUser {
  userId: string;
  email: string;
  role: string;
}

type AuthenticatedRequest = Request & { user: GatewayUser };

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get(':orderId')
  async findByOrderId(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const proxied = await this.proxyService.proxyRequest(
      'payments',
      request.method,
      request.originalUrl,
      undefined,
      { Authorization: request.headers.authorization! },
      request.user,
    );

    return response.status(proxied.status).send(proxied.data);
  }
}
