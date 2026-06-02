import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

export class SocketIoAdapter extends IoAdapter {
		createIOServer(port: number, options?: any): any {
		const server = super.createIOServer(port, {
			...options,
			cors: true,
			});
			return server;
		}
}

async function bootstrap() {
	const app = await NestFactory.create(AppModule, { cors: true });

  app.useGlobalPipes(new ValidationPipe({
        transform: true,
    }));
	app.use(cookieParser());

	app.useWebSocketAdapter(new SocketIoAdapter(app));

	const config = new DocumentBuilder()
		.setTitle('ft_transcendence')
		.setDescription('4-24 Pong')
		.setVersion('1.0')
		.addTag('4-24 Pong')
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('api', app, document);
	await app.listen(5000);
}
bootstrap();
