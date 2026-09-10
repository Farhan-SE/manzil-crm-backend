import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';

/** Comma-separated allowlist, e.g. "https://app.manzil.com,http://localhost:3000". */
function corsOrigin() {
  const configured = (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  // `true` reflects whatever Origin the request carries, which is a valid
  // Access-Control-Allow-Origin value — unlike '*' once credentials are involved.
  return configured.length > 0 ? configured : true;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
