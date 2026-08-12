import { HttpService } from '@nestjs/axios';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { serviceConfig } from '../../config/gateway.config';
import { RegisterDto } from '../dtos/register.dto';
import { LoginDto } from '../dtos/login.dto';

export interface UserSession {
  valid: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
  } | null;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface ValidatedUser {
  userId: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly httpService: HttpService) {}

  async validateJwtToken(authorization: string): Promise<ValidatedUser> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<ValidatedUser>(
          `${serviceConfig.users.url}/auth/validate-token`,
          {
            headers: { Authorization: authorization },
            timeout: serviceConfig.users.timeout,
          },
        ),
      );

      if (!data.userId || !data.email || !data.role) {
        throw new Error('Invalid validation response');
      }

      return data;
    } catch (error) {
      throw new UnauthorizedException('Invalid JWT token');
    }
  }

  async validateSessionToken(sessionToken: string): Promise<UserSession> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<UserSession>(
          `${serviceConfig.users.url}/sessions/validate/${sessionToken}`,
          { timeout: serviceConfig.users.timeout },
        ),
      );

      return data;
    } catch (error) {
      throw new UnauthorizedException('Invalid session token');
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${serviceConfig.users.url}/login`, loginDto, {
          timeout: serviceConfig.users.timeout,
        }),
      );

      return data;
    } catch (error) {
      throw new UnauthorizedException('Invalid login credentials');
    }
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(
          `${serviceConfig.users.url}/auth/register`,
          registerDto,
          { timeout: serviceConfig.users.timeout },
        ),
      );

      return data;
    } catch (error) {
      throw new UnauthorizedException('Registration failed');
    }
  }
}
