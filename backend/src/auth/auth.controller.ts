import { Controller, ForbiddenException, Get, Post, Res, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger'
import { AuthService } from './auth.service';
import { FtAuthGuard } from './ft.guard';
import { UserService } from 'src/user/user.service';
import { JwtAuthGuard } from 'src/auth/jwt.auth.guard';
import { UserStatus } from 'src/user/interface/user.status';
import { emailConfigured, frontendOrigin, oauth42Configured } from './auth-configuration';
import { GuestAdmissionLimitException, GuestAdmissionService } from './guest-admission.service';

@ApiTags('42 authentication')
@Controller('auth/')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private userService: UserService,
		private readonly guestAdmission: GuestAdmissionService,
	) {}

	@Get('config')
	configuration() {
		return { guest: process.env.ENABLE_GUEST_LOGIN === 'true', oauth42: oauth42Configured(), email2fa: emailConfigured() };
	}

	private completeLogin(res: any, token: string): void {
		// Vercel serves both services on the request's origin. A relative Location
		// keeps its host-only cookie on a stable alias as well as a deployment URL.
		const hosted = Boolean(process.env.VERCEL);
		const origin = hosted ? '' : frontendOrigin();
		res.cookie('token', token, {
			// The existing SPA exchanges this short-lived cookie for its bearer token.
			httpOnly: false, secure: hosted || origin.startsWith('https:'), sameSite: 'lax', path: '/', maxAge: 180000,
		});
		res.redirect(`${origin}/login?token=check`);
	}

	@ApiOperation({summary: '42 api로 인증할 Oauth provider로 redirect함'})
	@Get('42')
	@UseGuards(FtAuthGuard)
	login() {}

	@ApiOperation({summary: '인증 후 Oauth provider에서 redirect되고 인증 정보를 받음'})
  @Get('42/redirect')
	@UseGuards(FtAuthGuard)
	async redirect(@Req() req: any, @Res() res: any) {
		const token = await this.authService.issueJwtToken(req.user['name']);
		this.completeLogin(res, token);
	}

	@ApiOperation({summary: '포트폴리오 데모용 게스트 계정 생성 후 로그인'})
	@Get('guest')
  async guestLogin(@Req() req: any, @Res() res: any) {
		if (process.env.ENABLE_GUEST_LOGIN !== 'true')
			throw new ForbiddenException('Guest login is disabled');

		try {
			await this.guestAdmission.reserve(req);
		} catch (error) {
			if (error instanceof GuestAdmissionLimitException)
				res.setHeader('Retry-After', String(error.retryAfter));
			throw error;
		}
		const guest = await this.userService.createGuest();
		const token = await this.authService.issueJwtToken(guest.name);
		this.completeLogin(res, token);
	}

	@ApiOperation({summary: '로그아웃'})
	@Get('logout')
	@UseGuards(JwtAuthGuard)
	async logout(@Req() req: any, @Res() res: any) {
		console.log("logout\n");
		const user = req.user;
		if (user.need2fa === true && user.is2fa === true)
			user.is2fa = false;
		user.status = UserStatus.offline;
		await this.userService.update(user.id, { is2fa: user.is2fa, status: UserStatus.offline });
		res.send('logout');
	}

	@ApiOperation({summary: '2FA 인증 코드 발송'})
	@Get('email')
	@UseGuards(JwtAuthGuard)
  async sendEmail(@Req() req: any, @Res() res: any): Promise<void> {
		const user_email = req.user.email;
		const code = await this.authService.createCode(user_email);
		await this.authService.sendJoinMail(user_email, code);
		res.send('email sent');
	}

	@ApiOperation({summary: '2FA 코드 인증'})
	@Get('email/verify')
	@UseGuards(JwtAuthGuard)
	async verify2fa(@Req() req: any, @Res() res: any) {
		const { email, code } = req.query;
		if (typeof email !== 'string' || email.trim().toLowerCase() !== req.user.email.toLowerCase()) {
			res.status(400).send('failed');
			return;
		}
		const verify = await this.authService.verifyCode(email, code);
		if (verify)
		{
			const user = req.user;
			if (user.need2fa === true && user.is2fa === false)
			{
				user.is2fa = true;
				await this.userService.update(user.id, { is2fa: true });
			}
			console.log("2FA 인증 완료");
			res.send('verified');
		}
		else
		{
			console.log("2FA 인증 실패");
			res.send('failed');
		}
	}
}
