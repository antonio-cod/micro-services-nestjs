## Install

npm i @nestjs/config @nestjs/throttler @nestjs/swagger @nestjs/axios helmet
npm install -D @types/helmet
npm i class-validator
npm i -D @types/class-validator
npm i class-transformer
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm i -D @types/passport @types/passport-jwt
npm i --save-dev @types/jest

## Checkout E2E

O teste de integracao do checkout usa uma instancia real do gateway. Antes de
executa-lo, inicie users-service, products-service, checkout-service, seus bancos,
RabbitMQ e o api-gateway com o mesmo `JWT_SECRET`.

Por padrao, o teste acessa somente `http://localhost:3005`:

```bash
npm run test:e2e:checkout
```

Para usar outro endereco publico do gateway:

```bash
GATEWAY_URL=http://localhost:3105 npm run test:e2e:checkout
```
