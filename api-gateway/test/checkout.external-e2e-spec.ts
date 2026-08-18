import request from 'supertest';

const gatewayUrl = process.env.GATEWAY_URL ?? 'http://localhost:3005';
const paymentTimeoutMs = Number(process.env.PAYMENT_TIMEOUT_MS ?? 15000);
const paymentPollIntervalMs = Number(
  process.env.PAYMENT_POLL_INTERVAL_MS ?? 250,
);

jest.setTimeout(paymentTimeoutMs * 2);

interface AuthResponse {
  token: string;
  user: { id: string };
}

interface ProductResponse {
  id: string;
  price: number;
  isActive: boolean;
}

interface OrderResponse {
  id: string;
  cartId: string;
  paymentMethod: string;
  total: number;
  userId: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

interface PaymentResponse {
  orderId: string;
  userId: string;
  amount: number;
  paymentMethod: string;
  status: 'pending' | 'approved' | 'rejected';
  transactionId: string | null;
  rejectionReason: string | null;
}

describe('marketplace integration through the running gateway (e2e)', () => {
  const gateway = request(gatewayUrl);
  const runId = `${Date.now()}-${process.pid}`;
  const password = 'secret123';

  it('processes approved and rejected purchases only through the gateway', async () => {
    const seller = await registerAndLogin('seller');
    const approvedProduct = await createProduct(
      seller.token,
      `Approved product ${runId}`,
      150,
    );
    const rejectedProduct = await createProduct(
      seller.token,
      `Rejected product ${runId}`,
      49.99,
    );

    const catalog = await gateway.get('/products').expect(200);
    expect(catalog.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: approvedProduct.id, isActive: true }),
        expect.objectContaining({ id: rejectedProduct.id, isActive: true }),
      ]),
    );

    const buyer = await registerAndLogin('buyer');
    const authorization = `Bearer ${buyer.token}`;

    const approvedOrder = await purchase(
      authorization,
      buyer.user.id,
      approvedProduct,
    );
    const approvedPayment = await waitForPayment(
      authorization,
      approvedOrder.id,
      'approved',
    );
    expectPayment(
      approvedPayment,
      approvedOrder,
      buyer.user.id,
      approvedProduct.price,
      'approved',
    );
    expect(approvedPayment.transactionId).toEqual(expect.any(String));
    expect(approvedPayment.transactionId).not.toHaveLength(0);
    expect(approvedPayment.rejectionReason).toBeNull();
    await waitForOrderStatus(authorization, approvedOrder, 'paid');

    const emptyCart = await gateway
      .get('/cart')
      .set('Authorization', authorization)
      .expect(200);
    expect(emptyCart.body).toMatchObject({ id: null, total: 0, items: [] });

    const rejectedOrder = await purchase(
      authorization,
      buyer.user.id,
      rejectedProduct,
    );
    expect(rejectedOrder.id).not.toBe(approvedOrder.id);
    expect(rejectedOrder.cartId).not.toBe(approvedOrder.cartId);

    const rejectedPayment = await waitForPayment(
      authorization,
      rejectedOrder.id,
      'rejected',
    );
    expectPayment(
      rejectedPayment,
      rejectedOrder,
      buyer.user.id,
      rejectedProduct.price,
      'rejected',
    );
    expect(rejectedPayment.transactionId).toBeNull();
    expect(rejectedPayment.rejectionReason).toBe(
      'Cartão recusado pela operadora',
    );
    await waitForOrderStatus(authorization, rejectedOrder, 'failed');

    await gateway
      .get('/payments/00000000-0000-4000-8000-000000000000')
      .set('Authorization', authorization)
      .expect(404);
  });

  it('rejects checkout and payment routes without a token', async () => {
    await gateway.get('/cart').expect(401);
    await gateway
      .get('/payments/00000000-0000-4000-8000-000000000000')
      .expect(401);
  });

  it('reports the gateway and all marketplace services as healthy', async () => {
    const gatewayHealth = await gateway.get('/health').expect(200);
    expect(gatewayHealth.body).toEqual(
      expect.objectContaining({ status: 'ok' }),
    );

    const response = await gateway.get('/health/services').expect(200);
    expect(response.body).toMatchObject({
      overallStatus: 'healthy',
      summary: { total: 4, healthy: 4, unhealthy: 0, degraded: 0 },
    });
    expect(response.body.services).toEqual(
      expect.arrayContaining(
        ['users', 'products', 'checkout', 'payments'].map((name: string) =>
          expect.objectContaining({ name, status: 'healthy' }),
        ),
      ),
    );
  });

  async function registerAndLogin(role: 'seller' | 'buyer') {
    const email = `${role}-${runId}@example.com`;
    await gateway
      .post('/auth/register')
      .send({
        email,
        password,
        firstName: role === 'seller' ? 'Seller' : 'Buyer',
        lastName: runId,
        role,
      })
      .expect(201);

    const login = await gateway
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return login.body as AuthResponse;
  }

  async function createProduct(token: string, name: string, price: number) {
    const response = await gateway
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        description: 'Product created by the marketplace gateway E2E test',
        price,
        stock: 3,
      })
      .expect(201);
    return {
      ...(response.body as ProductResponse),
      price: Number(response.body.price),
    };
  }

  async function purchase(
    authorization: string,
    buyerId: string,
    product: ProductResponse,
  ): Promise<OrderResponse> {
    await gateway
      .post('/cart/items')
      .set('Authorization', authorization)
      .send({ productId: product.id, quantity: 1 })
      .expect(200);

    const cart = await gateway
      .get('/cart')
      .set('Authorization', authorization)
      .expect(200);
    expect(cart.body).toMatchObject({
      userId: buyerId,
      total: product.price,
      items: [
        expect.objectContaining({
          productId: product.id,
          price: product.price,
          quantity: 1,
          subtotal: product.price,
        }),
      ],
    });

    const checkout = await gateway
      .post('/cart/checkout')
      .set('Authorization', authorization)
      .send({ paymentMethod: 'pix' })
      .expect(201);
    const order = checkout.body as OrderResponse;
    expect(order).toMatchObject({
      cartId: cart.body.id,
      paymentMethod: 'pix',
      total: product.price,
      userId: buyerId,
      status: 'pending',
    });

    const orders = await gateway
      .get('/orders')
      .set('Authorization', authorization)
      .expect(200);
    expect(orders.body).toEqual(
      expect.arrayContaining([expect.objectContaining(order)]),
    );

    await gateway
      .get(`/orders/${order.id}`)
      .set('Authorization', authorization)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject(order));

    return order;
  }

  async function waitForOrderStatus(
    authorization: string,
    checkoutOrder: OrderResponse,
    expectedStatus: 'paid' | 'failed',
  ): Promise<OrderResponse> {
    const deadline = Date.now() + paymentTimeoutMs;
    let lastResult = 'no response';

    while (Date.now() < deadline) {
      const response = await gateway
        .get(`/orders/${checkoutOrder.id}`)
        .set('Authorization', authorization);
      lastResult = `${response.status}: ${JSON.stringify(response.body)}`;

      if (response.status === 200 && response.body.status === expectedStatus) {
        const updatedOrder = response.body as OrderResponse;
        expect(updatedOrder).toMatchObject({
          id: checkoutOrder.id,
          cartId: checkoutOrder.cartId,
          paymentMethod: checkoutOrder.paymentMethod,
          total: checkoutOrder.total,
          userId: checkoutOrder.userId,
          status: expectedStatus,
          createdAt: checkoutOrder.createdAt,
        });

        const orders = await gateway
          .get('/orders')
          .set('Authorization', authorization)
          .expect(200);
        expect(orders.body).toEqual(
          expect.arrayContaining([expect.objectContaining(updatedOrder)]),
        );
        return updatedOrder;
      }
      if (response.status !== 200 || response.body.status !== 'pending') {
        throw new Error(
          `Unexpected order response for ${checkoutOrder.id}: ${lastResult}`,
        );
      }
      await delay(paymentPollIntervalMs);
    }

    throw new Error(
      `Timed out waiting for order ${checkoutOrder.id} to become ${expectedStatus}; last result: ${lastResult}`,
    );
  }

  async function waitForPayment(
    authorization: string,
    orderId: string,
    expectedStatus: 'approved' | 'rejected',
  ): Promise<PaymentResponse> {
    const deadline = Date.now() + paymentTimeoutMs;
    let lastResult = 'no response';

    while (Date.now() < deadline) {
      const response = await gateway
        .get(`/payments/${orderId}`)
        .set('Authorization', authorization);
      lastResult = `${response.status}: ${JSON.stringify(response.body)}`;

      if (response.status === 404 || response.body.status === 'pending') {
        await delay(paymentPollIntervalMs);
        continue;
      }
      if (response.status !== 200) {
        throw new Error(
          `Unexpected payment response for order ${orderId}: ${lastResult}`,
        );
      }
      if (response.body.status !== expectedStatus) {
        throw new Error(
          `Unexpected terminal payment status for order ${orderId}: ${lastResult}`,
        );
      }
      return response.body as PaymentResponse;
    }

    throw new Error(
      `Timed out waiting for ${expectedStatus} payment for order ${orderId}; last result: ${lastResult}`,
    );
  }

  function expectPayment(
    payment: PaymentResponse,
    order: OrderResponse,
    buyerId: string,
    amount: number,
    status: 'approved' | 'rejected',
  ) {
    expect(payment).toMatchObject({
      orderId: order.id,
      userId: buyerId,
      amount,
      paymentMethod: 'pix',
      status,
    });
  }

  function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
});
