import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:5174,http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(cookieParser());
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('AlgoArena API')
    .setDescription('Full API documentation with working test cases for AlgoArena backend. Include authentication tokens (JWT) to test protected endpoints.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  // Protect Swagger UI in production
  app.use('/api/docs', (req: any, res: any, next: any) => {
    if (process.env.NODE_ENV === 'production') {
      const token = req.cookies?.access_token || req.cookies?.refresh_token;
      if (!token) return res.status(401).send('Unauthorized to view API Docs');
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        // Assuming roles are uppercase 'ADMIN', 'ORGANIZER' or similar
        const role = (payload.role || '').toUpperCase();
        if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'DEV') {
          return res.status(403).send('Forbidden: Admin/Dev access only');
        }
      } catch (e) {
        return res.status(401).send('Invalid token for API Docs access');
      }
    }
    next();
  });

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
