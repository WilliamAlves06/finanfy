import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // logs estruturados (pino) — docs/09
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  // validação global: whitelist + rejeita campos desconhecidos — docs/09
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // formato de erro único — docs/12
  app.useGlobalFilters(new GlobalExceptionFilter());

  // WEB_ORIGIN aceita lista separada por vírgula; defaults cobrem dev e produção
  const origins = (process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://finanfy.vercel.app',
      /https:\/\/finanfy-.*\.vercel\.app$/,
      ...origins,
    ],
  });
  app.setGlobalPrefix('v1', { exclude: ['health'] });

  // Swagger — docs/12
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Finanfy API')
    .setDescription('Assistente financeiro por conversa — API REST v1')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  // Render/Fly injetam PORT; local usa API_PORT
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
