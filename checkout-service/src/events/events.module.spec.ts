import { MODULE_METADATA } from '@nestjs/common/constants';
import { EventsModule } from './events.module';
import { PaymentResultConsumerService } from './payment-result/payment-result-consumer.service';

describe('EventsModule', () => {
  it('registers the payment result consumer', () => {
    const providers: unknown[] = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      EventsModule,
    ) as unknown[];

    expect(providers).toContain(PaymentResultConsumerService);
  });
});
