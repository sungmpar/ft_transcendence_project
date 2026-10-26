import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from './chat/chat.module';
import { GameModule } from './game/game.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from './infra/redis.service';

// Build the connection only after ConfigModule has loaded .env for local use.
// Hosted Postgres is managed separately; never synchronize on a cold start.
function databaseOptions() {
  const managed = Boolean(process.env.DATABASE_URL);
  if (process.env.VERCEL && !managed) {
    throw new Error('DATABASE_URL is required for the Vercel backend');
  }
  return managed
    ? {
        type: 'postgres' as const,
        url: process.env.DATABASE_URL,
        autoLoadEntities: true,
        synchronize: false,
        extra: { max: 5, idleTimeoutMillis: 10000 },
      }
    : {
        type: 'postgres' as const,
        port: Number(process.env.DB_PORT || 5432),
        host: process.env.DB_HOST,
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'test',
        database: process.env.DB_NAME || 'postgres',
        autoLoadEntities: true,
        // Preserve the old local Docker development behavior, never in Vercel.
        synchronize: process.env.DB_SYNCHRONIZE !== 'false',
      };
}

@Module({
  imports: [
		ConfigModule.forRoot({
      isGlobal: true,
      // Disposable integration children supply every credential explicitly.
      // Never load a developer's SMTP, OAuth, Blob or database .env in tests.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
		TypeOrmModule.forRootAsync({ useFactory: databaseOptions }),
		ScheduleModule.forRoot(),
		RedisModule,
		AuthModule,
		UserModule,
		ChatModule,
		GameModule,
	],
  providers: [],
})
export class AppModule {}
