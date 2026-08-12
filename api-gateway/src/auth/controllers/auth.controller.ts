import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { LoginDto } from '../dtos/login.dto';
import type { RegisterDto } from '../dtos/register.dto';
import { ProxyService } from '../../proxy/service/proxy.service';
import type { Response } from 'express';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login do usuário',
    description: 'Autentica um usuário e retorna JWT e session token',
  })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object' },
        accessToken: { type: 'string' },
        sessionToken: { type: 'string' },
        expiresIn: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const proxied = await this.proxyService.proxyRequest(
      'users',
      'POST',
      '/auth/login',
      loginDto,
    );
    response.status(proxied.status);
    return proxied.data;
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registro de usuário',
    description: 'Cria uma nova conta de usuário no sistema',
  })
  @ApiResponse({ status: 201, description: 'Usuário registrado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado' })
  @Throttle({ medium: { limit: 3, ttl: 60000 } })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const proxied = await this.proxyService.proxyRequest(
      'users',
      'POST',
      '/auth/register',
      registerDto,
    );
    response.status(proxied.status);
    return proxied.data;
  }
}
