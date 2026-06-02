import { Injectable, Inject, CACHE_MANAGER } from "@nestjs/common";
import { JwtService } from '@nestjs/jwt';
import { EmailService } from "./email.service";

@Injectable()
export class AuthService {
	constructor(
		private readonly jwtService: JwtService,
		private readonly emailService: EmailService,
		) {}
		private codes = new Map< string, string >();

	async issueJwtToken(username: string) {
		const payload = {
			username: username,
		}
		return this.jwtService.sign(payload, {
				secret: process.env.SECRET,
				expiresIn: '10800s',
			});
	}

	async createCode(email: string) {
		let code = '';
		for (let i = 0; i < 6; i++) {
			code += Math.floor(Math.random() * 10)
		}
		console.log('- verify email address: ', email);
		console.log('- verify email code: ', code);
		this.codes.set(email, code);
		return this.codes.get(email);
	}

	async sendJoinMail(email: string, code: string) {
		await this.emailService.sendJoinMail(email, code);
	}

	async verifyCode(email: string, code: string) {
		const value = this.codes.get(email);
		return value === code;
	}
}
