import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';


function corsOrigin() {
  const configured = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  // `true` reflects whatever Origin the request carries, which is a valid
  // Access-Control-Allow-Origin value — unlike '*' once credentials are involved.
  return configured.length > 0 ? configured : true;
}

async function bootstrap() {
  // rawBody: the WhatsApp webhook signature is computed over the exact bytes Meta sent.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Behind Railway's proxy (later the ALB), so rate limits see the visitor's IP, not the proxy's.
  app.set('trust proxy', 1);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  app.enableCors({
    origin: corsOrigin(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
  });
  // 0.0.0.0 so the container is reachable from outside it, not just localhost.
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
await bootstrap();
