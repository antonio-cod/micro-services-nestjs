import { ConfigService } from '@nestjs/config';

export function getJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET')?.trim();

  if (!secret) {
    throw new Error('JWT_SECRET deve ser definida com um valor não vazio');
  }

  return secret;
}
