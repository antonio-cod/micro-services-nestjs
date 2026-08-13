import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProxyModule } from '../proxy/proxy.module';
import { ProductsController } from './products.controller';

@Module({
  imports: [AuthModule, ProxyModule],
  controllers: [ProductsController],
})
export class ProductsModule {}
