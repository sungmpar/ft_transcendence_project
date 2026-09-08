import { Controller, ForbiddenException, Get, Post, Res, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger'
import { AuthService } from './auth.service';
import { FtAuthGuard } from './ft.guard';
import { UserService } from 'src/user/user.service';
import { JwtAuthGuard } from 'src/auth/jwt.auth.guard';
import { UserStatus } from 'src/user/interface/user.status';

@ApiTags('42 authentication')
@Controller('auth/')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private userService: UserService,
	) {}

	@ApiOperation({summary: '42 api로 인증할 Oauth provider로 redirect함'})
	@Get('42')
	@UseGuards(FtAuthGuard)
	login() {}

	@ApiOperation({summary: '인증 후 Oauth provider에서 redirect되고 인증 정보를 받음'})
  @Get('42/redirect')
	@UseGuards(FtAuthGuard)
	async redirect(@Req() req: any, @Res() res: any) {
		const token = await this.authService.issueJwtToken(req.user['name']);
		res.cookie('token', token, {
			httpOnly: false,
		});
		res.redirect(`${process.env.FRONT_URL}/login?token=check`);
	}

	@ApiOperation({summary: '포트폴리오 데모용 게스트 계정 생성 후 로그인'})
	@Get('guest')
  async guestLogin(@Req() req: any, @Res() res: any) {
    // Only this cookie-setting guest endpoint needs credentialed cross-origin
    // access. Restrict it to the configured frontend, before error responses too.
    try {
      const frontendOrigin = new URL(process.env.FRONT_URL).origin;
      if (
        ['http:', 'https:'].includes(new URL(process.env.FRONT_URL).protocol) &&
        req.headers.origin === frontendOrigin
      ) {
        res.header('Access-Control-Allow-Origin', frontendOrigin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.vary('Origin');
      }
    } catch {
      /* Invalid/missing FRONT_URL never broadens credential access. */
    }
		if (process.env.ENABLE_GUEST_LOGIN !== 'true')
			throw new ForbiddenException('Guest login is disabled');

		const guest = await this.userService.createGuest();
		const token = await this.authService.issueJwtToken(guest.name);
		res.cookie('token', token, {
			httpOnly: false,
		});
		res.redirect(`${process.env.FRONT_URL}/login?token=check`);
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
		await this.userService.update(user.id, user);
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
		const verify = await this.authService.verifyCode(email, code);
		if (verify)
		{
			const user = req.user;
			if (user.need2fa === true && user.is2fa === false)
			{
				user.is2fa = true;
				await this.userService.update(user.id, user);
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
