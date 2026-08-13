import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createSwaggerConfig } from './swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    createSwaggerConfig(),
  );
  SwaggerModule.setup('api', app, swaggerDocument);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`📦 Products Service running on port ${port}`);
}

void bootstrap();
