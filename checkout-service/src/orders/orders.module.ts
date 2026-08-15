import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { CartModule } from '../cart/cart.module';
import { EventsModule } from '../events/events.module';
import { CheckoutController } from './checkout.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    CartModule,
    forwardRef(() => EventsModule),
  ],
  controllers: [CheckoutController, OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
