import request from 'supertest';

const gatewayUrl = process.env.GATEWAY_URL ?? 'http://localhost:3005';

interface AuthResponse {
  token: string;
  user: { id: string };
}

describe('checkout-service integration through the running gateway (e2e)', () => {
  const gateway = request(gatewayUrl);
  const runId = `${Date.now()}-${process.pid}`;
  const password = 'secret123';

  it('executes the complete purchase flow only through the gateway', async () => {
    const sellerEmail = `seller-${runId}@example.com`;
    const buyerEmail = `buyer-${runId}@example.com`;

    await gateway
      .post('/auth/register')
      .send({
        email: sellerEmail,
        password,
        firstName: 'Seller',
        lastName: runId,
        role: 'seller',
      })
      .expect(201);

    const sellerLogin = await gateway
      .post('/auth/login')
      .send({ email: sellerEmail, password })
      .expect(200);
    const seller = sellerLogin.body as AuthResponse;

    const productResponse = await gateway
      .post('/products')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({
        name: `Integration product ${runId}`,
        description: 'Product created by the checkout gateway E2E test',
        price: 49.9,
        stock: 3,
      })
      .expect(201);
    const productId = productResponse.body.id as string;

    await gateway
      .post('/auth/register')
      .send({
        email: buyerEmail,
        password,
        firstName: 'Buyer',
        lastName: runId,
        role: 'buyer',
      })
      .expect(201);

    const buyerLogin = await gateway
      .post('/auth/login')
      .send({ email: buyerEmail, password })
      .expect(200);
    const buyer = buyerLogin.body as AuthResponse;
    const authorization = `Bearer ${buyer.token}`;

    const addedCart = await gateway
      .post('/cart/items')
      .set('Authorization', authorization)
      .send({ productId, quantity: 1 })
      .expect(200);
    expect(addedCart.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId, quantity: 1 }),
      ]),
    );

    const cartResponse = await gateway
      .get('/cart')
      .set('Authorization', authorization)
      .expect(200);
    expect(cartResponse.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ productId })]),
    );

    const orderResponse = await gateway
      .post('/cart/checkout')
      .set('Authorization', authorization)
      .send({ paymentMethod: 'pix' })
      .expect(201);
    const order = orderResponse.body as {
      id: string;
      cartId: string;
      paymentMethod: string;
      userId: string;
    };
    expect(order).toMatchObject({
      cartId: cartResponse.body.id,
      paymentMethod: 'pix',
      userId: buyer.user.id,
    });

    const ordersResponse = await gateway
      .get('/orders')
      .set('Authorization', authorization)
      .expect(200);
    expect(ordersResponse.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: order.id })]),
    );

    await gateway
      .get(`/orders/${order.id}`)
      .set('Authorization', authorization)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject(order);
      });
  });

  it('rejects checkout routes without a token', async () => {
    await gateway.get('/cart').expect(401);
  });
});
