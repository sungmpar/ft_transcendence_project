import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from './chat/chat.module';
import { GameModule } from './game/game.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
		ConfigModule.forRoot({
      isGlobal: true,
    }),
		TypeOrmModule.forRoot({
      type: 'postgres',
      port: 5432,
      host: process.env.DB_HOST,
      username: 'root',
      password: 'test',
      database: 'postgres',
      autoLoadEntities: true,
			synchronize: true,
    }),
		ScheduleModule.forRoot(),
		AuthModule,
		UserModule,
		ChatModule,
		GameModule,
	],
  providers: [],
})
export class AppModule {}
