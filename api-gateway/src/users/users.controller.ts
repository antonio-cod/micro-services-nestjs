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

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('profile')
  profile(@Req() request: AuthenticatedRequest, @Res() response: Response) {
    return this.forward(request, response);
  }

  @Get('sellers')
  sellers(@Req() request: AuthenticatedRequest, @Res() response: Response) {
    return this.forward(request, response);
  }

  @Get(':id')
  findById(@Req() request: AuthenticatedRequest, @Res() response: Response) {
    return this.forward(request, response);
  }

  private async forward(request: AuthenticatedRequest, response: Response) {
    const authorization = request.headers.authorization;
    const proxied = await this.proxyService.proxyRequest(
      'users',
      request.method,
      request.originalUrl,
      undefined,
      authorization ? { Authorization: authorization } : undefined,
      request.user,
    );

    return response.status(proxied.status).send(proxied.data);
  }
}
