import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform:true,
  }));
  app.enableCors({
      origin: '*',
      methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
      allowedHeaders: ['Content-Type','Authorization'],
      credentials: true,              
      exposedHeaders: ['Content-Disposition'], 
      maxAge: 600,                    
    });
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
