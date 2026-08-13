import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { createSwaggerConfig } from './swagger.config';

describe('Products Service Swagger configuration', () => {
  it('configures the API identity and bearer authentication', () => {
    const config = createSwaggerConfig();

    expect(config.info).toMatchObject({
      title: 'Products Service',
      version: '1.0',
    });
    expect(config.components?.securitySchemes).toMatchObject({
      'JWT-auth': {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    });
  });

  it('documents creation as protected and queries as public', async () => {
    const module = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: {} }],
    }).compile();
    const app = module.createNestApplication();
    const document = SwaggerModule.createDocument(app, createSwaggerConfig());

    expect(document.paths['/products']?.post?.security).toEqual([
      { 'JWT-auth': [] },
    ]);
    expect(document.paths['/products']?.get?.security).toBeUndefined();
    expect(
      document.paths['/products/seller/{sellerId}']?.get?.security,
    ).toBeUndefined();
    expect(document.paths['/products/{id}']?.get?.security).toBeUndefined();

    await app.close();
  });
});
