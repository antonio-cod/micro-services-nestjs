import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { ProxyModule } from './proxy/proxy.module';
// import { ProxyService } from './proxy/service/proxy.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ProxyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
  // exports: [ProxyService],
})
export class AppModule {}
