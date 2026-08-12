import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProxyModule } from '../proxy/proxy.module';
import { UsersController } from './users.controller';

@Module({
  imports: [AuthModule, ProxyModule],
  controllers: [UsersController],
})
export class UsersModule {}
