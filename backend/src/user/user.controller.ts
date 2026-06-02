import { Controller,UseGuards, Query, Req, Res, Post, Get, Patch, UseInterceptors, Bind, UploadedFile, HttpException } from '@nestjs/common';
import { UserGuard } from './user.guard';
import { UserService } from './user.service';
import { User } from './entity/user.entity';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { multerDiskOptions } from './multer.options'
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from 'src/auth/jwt.auth.guard';
import { UserStatus } from './interface/user.status';

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
	async getUser(@Query('id') id?: number) {
		return await this.userService.getOne(id);
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
	@UseInterceptors(FilesInterceptor('file', null, multerDiskOptions))
	@Bind(UploadedFile())
	async uploadedFile(files: File[], @Req() req: any, @Res() res: any){
		const name: string = req.user.name;
		const ext: string = req.files[0].mimetype.split('/')[1];
		const path: string = `./profiles/${name}.${ext}`
		this.profileService.updateProfileUrl(name, path);
		res.send('uploaded');
	};

	@Patch('/nickname')
	@UseGuards(JwtAuthGuard, UserGuard)
	async setNickname(@Req() req: any, @Res() res: any){
		const user: User = req.user;
		const nickname: string = req.body.nickname;
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
		await this.userService.update(user.id, user);
		res.send('updated');
	}

	@Patch('/need2fa')
	@UseGuards(JwtAuthGuard)
	async setNeed2fa(@Req() req: any, @Res() res: any){
		const user: User = req.user;
		const value: boolean = req.body.value;
		user.need2fa = value;
		await this.userService.update(user.id, user);
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
		if (user.id === req.body.id)
			throw new HttpException('cannot add self', 403);
		else if (user.friends.includes(req.body.id))
			throw new HttpException('already friends', 409);
		user.friends.push(req.body.id);
		await this.userService.update(user.id, user);
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
		if (user.id === req.body.id)
			throw new HttpException('cannot block self', 403);
		else if (user.blocks.includes(req.body.id))
			throw new HttpException('already blocks', 409);
		user.blocks.push(req.body.id);
		await this.userService.update(user.id, user);
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
		const profileUrl = user.profileUrl;
		const ext = profileUrl.split('.')[2];
		const filename = user.name;
		var fs = require('fs');
		var stream = fs.createReadStream(profileUrl);
		res.set({
			'Content-Type': `image/${ext}`,
			'Content-Disposition': `attachment; filename=${filename}`
		})
		stream.pipe(res);
	}

	@Get('/image/:id')
	async downloadSelfImage(@Req() req: any, @Res() res: any) {
		const id: number = req.params.id;
		const user: User = await this.userService.getOne(id);
		if (!user)
			throw new HttpException('not found', 404);
		const profileUrl = user.profileUrl;
		const ext = profileUrl.split('.')[2];
		const filename = user.name;
		var fs = require('fs');
		var stream = fs.createReadStream(profileUrl);
		res.set({
			'Content-Type': `image/${ext}`,
			'Content-Disposition': `filename=${filename}`
		})
		stream.pipe(res);
	}

	@Get('/:id')
	@UseGuards(JwtAuthGuard, UserGuard)
	async getUserProfile(@Req() req: any, @Res() res: any) {
		const id: number = req.params.id;
		const user: User = await this.userService.getOne(id);
		const info = {
			id: user.id,
			nickname: user.nickname,
			profileUrl: user.profileUrl,
			status: user.status
		}
		res.send(info);
	}
}
