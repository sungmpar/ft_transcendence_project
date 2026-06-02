import { PassportStrategy } from "@nestjs/passport";
import { Strategy, Profile } from "passport-42";
import { Injectable } from "@nestjs/common";
import { User } from "../user/entity/user.entity";
import { AuthService } from "./auth.service";
import { UserService } from "../user/user.service";
import { ProfileService } from "src/user/profile.service";

@Injectable()
export class FtStrategy extends PassportStrategy(Strategy, '42') {
	constructor(
		private readonly authService: AuthService,
		private userService: UserService,
		private profileService: ProfileService,
		) {
		super({
			clientID: process.env.CLIENT_UID,
			clientSecret: process.env.CLIENT_SEC,
			callbackURL: process.env.CALLBACK,
			scope: ['public']
		});
	}

	async validate(accessToken: string, refreshToken: string, profile: Profile): Promise<User> {
			const { username } = profile;
			const userEntity = await this.userService.getOneByName(username);
			if (userEntity !== null) {
				return userEntity;
			}
			const user = {
				name: username,
				email: profile['emails'][0]['value'],
				profileUrl: process.env.DEFAULT_IMG,
			};
			const newUser = await this.userService.create(user);
			return newUser;
	}
}
