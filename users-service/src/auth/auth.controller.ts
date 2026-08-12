import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { AuthService, LoginResult, PublicUser } from './auth.service';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

export interface ValidatedToken {
  userId: string;
  email: string;
  role: AuthenticatedUser['role'];
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto): Promise<PublicUser> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto): Promise<LoginResult> {
    return this.authService.login(loginDto);
  }

  @Get('validate-token')
  @ApiBearerAuth()
  @ApiOkResponse({
    schema: {
      example: {
        userId: '91afac99-0cd9-4438-945e-2766594a725c',
        email: 'user@example.com',
        role: 'buyer',
      },
    },
  })
  validateToken(@Req() request: AuthenticatedRequest): ValidatedToken {
    return {
      userId: request.user.id,
      email: request.user.email,
      role: request.user.role,
    };
  }
}
