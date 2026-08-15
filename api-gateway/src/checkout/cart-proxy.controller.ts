import {
  Body,
  Controller,
  Delete,
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
@Controller('cart')
export class CartProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post('items')
  addItem(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    return this.forward(request, response, body);
  }

  @Get()
  findActive(@Req() request: AuthenticatedRequest, @Res() response: Response) {
    return this.forward(request, response);
  }

  @Delete('items/:itemId')
  removeItem(@Req() request: AuthenticatedRequest, @Res() response: Response) {
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
