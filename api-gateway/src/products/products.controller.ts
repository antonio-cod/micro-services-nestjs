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
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../guards/auth.guard';
import { ProxyService } from '../proxy/service/proxy.service';

interface GatewayUser {
  userId: string;
  email: string;
  role: string;
}

type GatewayRequest = Request & { user?: GatewayUser };

@ApiTags('Products')
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly proxyService: ProxyService) {}

  @Public()
  @Get()
  findAll(@Req() request: GatewayRequest, @Res() response: Response) {
    return this.forward(request, response);
  }

  @Public()
  @Get('seller/:sellerId')
  findBySeller(@Req() request: GatewayRequest, @Res() response: Response) {
    return this.forward(request, response);
  }

  @Public()
  @Get(':id')
  findOne(@Req() request: GatewayRequest, @Res() response: Response) {
    return this.forward(request, response);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  create(
    @Body() body: unknown,
    @Req() request: GatewayRequest,
    @Res() response: Response,
  ) {
    return this.forward(request, response, body);
  }

  private async forward(
    request: GatewayRequest,
    response: Response,
    body?: unknown,
  ) {
    const authorization = request.headers.authorization;
    const proxied = await this.proxyService.proxyRequest(
      'products',
      request.method,
      request.originalUrl,
      body,
      authorization ? { Authorization: authorization } : undefined,
      request.user,
    );

    return response.status(proxied.status).send(proxied.data);
  }
}
