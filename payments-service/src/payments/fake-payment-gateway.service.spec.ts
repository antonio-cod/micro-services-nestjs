import { FakePaymentGatewayService } from './fake-payment-gateway.service';

describe('FakePaymentGatewayService', () => {
  const service = new FakePaymentGatewayService();

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  async function process(amount: number) {
    const resultPromise = service.process(amount);
    await jest.advanceTimersByTimeAsync(499);
    let settled = false;
    void resultPromise.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    return resultPromise;
  }

  it.each([10000.01, 10000.99])(
    'rejects %s because it exceeds the limit',
    async (amount) => {
      await expect(process(amount)).resolves.toEqual({
        approved: false,
        rejectionReason: 'Limite excedido',
      });
    },
  );

  it('rejects an amount ending in .99', async () => {
    await expect(process(25.99)).resolves.toEqual({
      approved: false,
      rejectionReason: 'Cartão recusado pela operadora',
    });
  });

  it.each([10000, 25])('approves %s', async (amount) => {
    const result = await process(amount);
    expect(result.approved).toBe(true);
    expect(result.transactionId).toEqual(expect.any(String));
    expect(result.rejectionReason).toBeUndefined();
  });
});
