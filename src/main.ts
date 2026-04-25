import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { I18nValidationPipe } from 'nestjs-i18n';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WsAdapter } from '@nestjs/platform-ws';
import { setDefaultResultOrder } from 'node:dns';
import compression from 'compression';

function swaggerDocsMessage(
  req: { headers?: Record<string, string | string[] | undefined> },
  key: 'unauthorized' | 'forbidden' | 'invalidToken',
): string {
  const raw = req.headers?.['accept-language'];
  const al = Array.isArray(raw) ? raw[0] : raw;
  const fr = String(al || '')
    .toLowerCase()
    .startsWith('fr');
  const messages = {
    unauthorized: fr
      ? 'Non autorisé à consulter la documentation API'
      : 'Unauthorized to view API Docs',
    forbidden: fr
      ? 'Interdit : accès réservé aux administrateurs / développeurs'
      : 'Forbidden: Admin/Dev access only',
    invalidToken: fr
      ? 'Jeton invalide pour l’accès à la documentation API'
      : 'Invalid token for API Docs access',
  };
  return messages[key];
}

async function bootstrap() {
  // Some environments expose IPv6 DNS answers without IPv6 routing,
  // which causes intermittent OAuth network errors. Prefer IPv4 first.
  setDefaultResultOrder('ipv4first');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
    credentials: true,
  });

  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.use(cookieParser());
  // Prefer a Brotli-capable compressor if available, fall back to gzip/deflate
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const shrinkRay = require('shrink-ray-current');
    app.use(shrinkRay());
  } catch (e) {
    app.use(compression());
  }

  // Serve uploads with long cache lifetime and immutable header for repeat visits
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    maxAge: oneMonthMs,
    setHeaders: (res: any, _path: string, _stat: any) => {
      res.setHeader('Cache-Control', `public, max-age=${oneMonthMs / 1000}, immutable`);
    },
  });

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('AlgoArena API')
    .setDescription(
      'Full API documentation with working test cases for AlgoArena backend. Include authentication tokens (JWT) to test protected endpoints.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  // Protect Swagger UI in production
  app.use('/api/docs', (req: any, res: any, next: any) => {
    if (process.env.NODE_ENV === 'production') {
      const token = req.cookies?.access_token || req.cookies?.refresh_token;
      if (!token)
        return res.status(401).send(swaggerDocsMessage(req, 'unauthorized'));
      try {
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString(),
        );
        // Assuming roles are uppercase 'ADMIN', 'ORGANIZER' or similar
        const role = (payload.role || '').toUpperCase();
        if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'DEV') {
          return res.status(403).send(swaggerDocsMessage(req, 'forbidden'));
        }
      } catch (e) {
        return res.status(401).send(swaggerDocsMessage(req, 'invalidToken'));
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
