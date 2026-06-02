import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { Repository } from 'typeorm';
import { UserDto } from './dto/user.dto';
import { UserService } from './user.service';

@Injectable()
export class ProfileService {
	constructor(
		private userService: UserService,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
	){}

	async updateProfileUrl(name: string, path: string) {
		const user = await this.userService.getOneByName(name);
		if (user.profileUrl !== path){
			if (user.profileUrl !== "./profiles/default.jpeg"){
				this.deleteImage(user.profileUrl);
			}
			user.profileUrl = path;
			await this.userRepository.update(user.id, user);
		}
	}

	async deleteImage(path: string): Promise<any> {
		let fs = await require('fs'); // fs.exists로 폴더에 파일 존재 유무 확인하기
		await fs.stat(path, function (err) {
			if (err) {
				return console.error(err);
			}
			fs.unlinkSync(path);
		})
	}
}
