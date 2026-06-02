import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entity/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserGuard } from './user.guard';
import { AuthModule } from 'src/auth/auth.module';
import { forwardRef } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { Match } from './entity/match.entity';
import { MatchService } from './match.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([User, Match]),
		forwardRef(() => AuthModule),
	],
  controllers: [UserController],
  providers: [UserService, UserGuard, ProfileService, MatchService],
	exports: [UserService, ProfileService, MatchService],
})
export class UserModule {}
