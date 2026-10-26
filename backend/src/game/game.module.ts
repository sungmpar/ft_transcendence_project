import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';
import { JwtService } from '@nestjs/jwt';
import { RedisGameCoordinator } from './redis-game-coordinator';

@Module({
	imports: [
		UserModule,
		AuthModule,
	],
  controllers: [GameController],

  providers: [GameService, RedisGameCoordinator, GameGateway, JwtService],
})
export class GameModule {}
