import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('Health Swagger documentation', () => {
  it('documents the public Terminus success and failure contracts', async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: { check: jest.fn() } },
        { provide: TypeOrmHealthIndicator, useValue: { pingCheck: jest.fn() } },
      ],
    }).compile();
    const app = module.createNestApplication();
    const config = new DocumentBuilder()
      .setTitle('Users Service')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    const operation = document.paths['/health']?.get;

    expect(operation).toBeDefined();
    expect(operation?.responses['200']).toBeDefined();
    expect(operation?.responses['503']).toBeDefined();
    expect(operation?.security).toBeUndefined();

    const successfulResponse = JSON.stringify(operation?.responses['200']);
    const unavailableResponse = JSON.stringify(operation?.responses['503']);

    expect(successfulResponse).toContain('database');
    expect(successfulResponse).toContain('up');
    expect(unavailableResponse).toContain('database');
    expect(unavailableResponse).toContain('down');
    expect(successfulResponse).not.toContain('users-service');
    expect(unavailableResponse).not.toContain('users-service');

    await app.close();
  });
});
