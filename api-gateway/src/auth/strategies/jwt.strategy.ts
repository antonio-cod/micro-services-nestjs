import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { AuthService } from '../service/auth.service';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: JwtPayload) {
    const authorization = request.headers.authorization;

    if (!payload || !authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.authService.validateJwtToken(authorization);

    if (
      user.userId !== payload.sub ||
      user.email !== payload.email ||
      user.role !== payload.role
    ) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
