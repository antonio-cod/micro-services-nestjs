import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
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

@ApiTags('Checkout')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class OrdersProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post('cart/checkout')
  checkout(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    return this.forward(request, response, body);
  }

  @Get('orders')
  findAll(@Req() request: AuthenticatedRequest, @Res() response: Response) {
    return this.forward(request, response);
  }

  @Get('orders/:id')
  findOne(@Req() request: AuthenticatedRequest, @Res() response: Response) {
    return this.forward(request, response);
  }

  private async forward(
    request: AuthenticatedRequest,
    response: Response,
    body?: unknown,
  ) {
    const proxied = await this.proxyService.proxyRequest(
      'checkout',
      request.method,
      request.originalUrl,
      body,
      { Authorization: request.headers.authorization! },
      request.user,
    );

    return response.status(proxied.status).send(proxied.data);
  }
}
