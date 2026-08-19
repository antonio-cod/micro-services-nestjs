import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import {
  HealthCheckService,
  MicroserviceHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { HEALTH_RABBITMQ_OPTIONS } from './health/health.constants';
import { HealthController } from './health/health.controller';
import { createSwaggerConfig } from './swagger.config';

describe('Checkout Service Swagger configuration', () => {
  it('configures the API identity and bearer authentication', () => {
    const config = createSwaggerConfig();

    expect(config.info).toMatchObject({
      title: 'Checkout Service',
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

  it('documents the public health endpoint and its response', async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: { check: jest.fn() } },
        { provide: TypeOrmHealthIndicator, useValue: { pingCheck: jest.fn() } },
        {
          provide: MicroserviceHealthIndicator,
          useValue: { pingCheck: jest.fn() },
        },
        { provide: HEALTH_RABBITMQ_OPTIONS, useValue: {} },
      ],
    }).compile();
    const app = module.createNestApplication();
    const document = SwaggerModule.createDocument(app, createSwaggerConfig());

    expect(document.paths['/health']?.get).toBeDefined();
    expect(document.paths['/health']?.get?.responses['200']).toBeDefined();
    expect(document.paths['/health']?.get?.responses['503']).toBeDefined();
    expect(document.paths['/health']?.get?.security).toBeUndefined();

    await app.close();
  });
});
