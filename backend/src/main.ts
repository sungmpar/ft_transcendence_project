import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { RedisService } from './infra/redis.service';
import { RedisIoAdapter } from './infra/redis-io.adapter';

async function bootstrap() {
	const app = await NestFactory.create(AppModule, { cors: true });
	app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe({
        transform: true,
    }));
	app.use(cookieParser());

	const redisAdapter = new RedisIoAdapter(app, app.get(RedisService));
	await redisAdapter.connect();
	app.useWebSocketAdapter(redisAdapter);

	// Only becomes reachable after Nest and its database providers initialize.
	// Functional flows (OAuth, email, Blob and gameplay) have separate checks.
	app.getHttpAdapter().get('/health', (_request, response) => {
		response.setHeader('Cache-Control', 'no-store');
		response.status(200).json({ status: 'ok' });
	});

	const config = new DocumentBuilder()
		.setTitle('ft_transcendence')
		.setDescription('4-24 Pong')
		.setVersion('1.0')
		.addTag('4-24 Pong')
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('api', app, document);
	await app.listen(Number(process.env.PORT || 5000), '0.0.0.0');
}
bootstrap();
