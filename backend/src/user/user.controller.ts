import { Controller,UseGuards, Query, Param, Req, Res, Post, Get, Patch, UseInterceptors, UploadedFile, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { UserGuard } from './user.guard';
import { UserService } from './user.service';
import { User } from './entity/user.entity';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerDiskOptions } from './multer.options'
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from 'src/auth/jwt.auth.guard';
import { UserStatus } from './interface/user.status';
import { emailConfigured } from '../auth/auth-configuration';
import { publicUserId, publicUserProfile } from './public-profile';

@ApiTags('user management')
@Controller('user')
export class UserController {
  constructor(
		private readonly userService: UserService,
		private readonly profileService: ProfileService
		) {}

	@ApiOperation({summary: 'id로 user profile 조회'})
	@Get('/')
	@UseGuards(JwtAuthGuard, UserGuard)
	async getUser(@Query('id') id: unknown) {
		return publicUserProfile(await this.userService.getOne(publicUserId(id)));
	}

	@Patch('/status')
	@UseGuards(JwtAuthGuard)
	async setStatus(@Req() req: any, @Res() res: any){
		const user: User = req.user;
		const value: UserStatus = req.body.value;
		console.log("value : ", value);
		await this.userService.updateStatus(user, value);
		res.send('updated');
	}

	@ApiOperation({summary: 'my profile 조회'})
	@Get('/me')
	@UseGuards(JwtAuthGuard, UserGuard)
	async getMyProfile(@Req() req: any) {
		const user: User = req.user;
		// console.log(user);
		return await this.userService.getOne(user.id);
	}

	@Post('/upload')
	@UseGuards(JwtAuthGuard, UserGuard)
	@UseInterceptors(FileInterceptor('file', multerDiskOptions))
	async uploadedFile(@UploadedFile() file: any, @Req() req: any, @Res() res: any){
		if (!file) throw new HttpException('이미지 파일이 필요합니다.', 400);
		await this.profileService.saveProfileImage(req.user, file);
		res.send('uploaded');
	};

	@Patch('/nickname')
	@UseGuards(JwtAuthGuard, UserGuard)
	async setNickname(@Req() req: any, @Res() res: any){
		const user: User = req.user;
		const nickname: string = req.body.nickname;
		if (typeof nickname !== 'string') throw new HttpException('닉네임을 입력해 주세요.', 400);
		if (nickname.length > 10)
			throw new HttpException('닉네임은 10글자를 초과할수 없습니다.', 400);
		else if (await this.userService.IsInvalidNicknameLength(nickname))
			throw new HttpException('이미 등록한 닉네임입니다.', 400);
		else if (nickname.length < 2)
			throw new HttpException('닉네임은 2글자 미만일수 없습니다.', 400);
		else if (nickname.includes(' '))
			throw new HttpException('닉네임은 공백을 포함할수 없습니다.', 400);
		else if (await this.userService.IsInvalidNicknameChars(nickname))
			throw new HttpException('닉네임은 특수문자를 포함할수 없습니다.', 400);
		user.nickname = nickname;
		await this.userService.update(user.id, { nickname });
		res.send('updated');
	}

	@Patch('/need2fa')
	@UseGuards(JwtAuthGuard, UserGuard)
	async setNeed2fa(@Req() req: any, @Res() res: any){
		const user: User = req.user;
		const value: boolean = req.body.value;
		if (typeof value !== 'boolean') throw new HttpException('value must be a boolean', 400);
		if (value && !emailConfigured()) throw new ServiceUnavailableException('Email delivery is not configured for this deployment');
		if (value && user.email.endsWith('@guest.local')) throw new HttpException('Guest accounts do not have a deliverable email address for 2FA', 400);
		user.need2fa = value;
		user.is2fa = false;
		await this.userService.update(user.id, { need2fa: value, is2fa: false });
		res.send('updated');
	}

	@Get('/friends')
	@UseGuards(JwtAuthGuard, UserGuard)
	async getFriends(@Req() req: any) {
		const user: User = req.user;
		return await this.userService.fetchFriends(user.id);
	}

	@Patch('/friends')
	@UseGuards(JwtAuthGuard, UserGuard)
	async addFriend(@Req() req: any, @Res() res: any){
		const user: User = req.user;
		await this.userService.addFriend(user.id, req.body.id);
		res.send('updated');
	}

	@Get('/blocks')
	@UseGuards(JwtAuthGuard, UserGuard)
	async getBlocks(@Req() req: any) {
		console.log("addBlock" , req.body.id);
		const user: User = req.user;
		return await this.userService.fetchBlocks(user.id);
	}

	@Patch('/blocks')
	@UseGuards(JwtAuthGuard, UserGuard)
	async addBlock(@Req() req: any, @Res() res: any){
		const user: User = req.user;
		await this.userService.addBlock(user.id, req.body.id);
		res.send('updated');
	}

	@Get('/match')
	@UseGuards(JwtAuthGuard, UserGuard)
	async fetchMatch(@Req() req: any) {
		const users = await this.userService.getAll();
		const matches = await Promise.all(users.map(async (user) => {
			return await this.userService.fetchMatch(user);
		}))
		console.log(matches);
		return matches;
	}

	@Get('/image/me')
	@UseGuards(JwtAuthGuard, UserGuard)
	async downloadUserImage(@Req() req: any, @Res() res: any) {
		const user: User = req.user;
		this.profileService.sendProfileImage(user, res);
	}

	@Get('/image/:id')
	async downloadSelfImage(@Req() req: any, @Res() res: any) {
		const id: number = req.params.id;
		const user: User = await this.userService.getOne(id);
		if (!user)
			throw new HttpException('not found', 404);
		this.profileService.sendProfileImage(user, res);
	}

	@Get('/:id')
	@UseGuards(JwtAuthGuard, UserGuard)
	async getUserProfile(@Param('id') id: unknown) {
		return publicUserProfile(await this.userService.getOne(publicUserId(id)));
	}
}
