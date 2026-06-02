import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, ForbiddenException } from '@nestjs/common';
import { User } from '../user/entity/user.entity';
import { UserService } from '../user/user.service';

export interface JwtPayload {
	username: string;
	auth: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
		private userService: UserService,
	) {
    super({
      secretOrKey: process.env.SECRET,
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
    });
  }


	async validate(payload: JwtPayload) {
		const { username } = payload;
		const user: User = await this.userService.getOneByName(username);
		if (!user) {
			throw new ForbiddenException();
		}

		return user;
	}
}
