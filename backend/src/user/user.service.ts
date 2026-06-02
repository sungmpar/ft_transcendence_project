import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { UserDto } from './dto/user.dto';
import { Repository } from 'typeorm';
import { UserStatus } from './interface/user.status';
import { MatchService } from './match.service';
import { UserLadder } from './interface/user.ladder';

@Injectable()
export class UserService {
	constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
		private readonly matchService: MatchService,
	) {}

	async create(user: UserDto) {
		const newUser = this.userRepository.create(user);
		return await this.userRepository.save(newUser);
	}

	async getOneByName(name: string) {
		const user = await this.userRepository.findOne({
			where: { name: name },
		});
		return user;
	}

	async getOne(id: number) {
		const user = await this.userRepository.findOne({
			where: { id: id },
		});
		return user;
	}

	async getAll() {
		const users = await this.userRepository.find();
		return users;
	}

	async update(id: number, user: UserDto) {
		if (await this.userRepository.update(id, user))
			return await this.getOne(id);
		throw new NotFoundException();
	}

	async isBanned(id: number) {
		const user = await this.userRepository.findOne({
			where: {
				id: id,
				isBanned: true,
			},
		});
		if (!user)
			return false;
		return true;
	}

	async fetchUsers() {
		const users = (await this.userRepository.find({
		})).map(user => {
			return {
				id: user.id,
				name: user.nickname,
				status: user.status,
			};
		});
		if (!users)
			return null;
		return users;
	}

	async fetchFriends(id: number) {
		const user = await this.getOne(id);
		if (!user)
			throw new NotFoundException();
		const friends = await Promise.all(user.friends.map(async friendId => {
			const info = await this.userRepository.findOne({
				where: { id: friendId },
			});
			return {
				id: info.id,
				name: info.name,
				nickname: info.nickname,
				profileUrl: info.profileUrl,
				status: info.status,
			}
		}, []));
		if (!friends)
			null;
		return friends;
	}

	async fetchBlocks(id: number) {
		const user = await this.getOne(id);
		if (!user)
			throw new NotFoundException();
		return (user.blocks? user.blocks: []);
	}

	async updateStatus(user: User, status: UserStatus) {
		user.status = status;
		await this.userRepository.save(user);
		return true;
	}

	async updateAchievement(id: number, achievement: string) {
		const user = await this.getOne(id);
		if(user.achievement.includes(achievement))
			return false;
		user.achievement.push(achievement);
		await this.userRepository.save(user);
		return true;
	}

	async updateLadder(id: number, ladder: UserLadder) {
		const user = await this.getOne(id);
		if (user.ladder != ladder){
			user.ladder = ladder;
			await this.userRepository.save(user);
		}
		return true;
	}

	async IsInvalidNicknameLength(nickname: string) {
		if (await this.userRepository.findOne({
			where: { nickname: nickname },
		}) != null)
			return true;
		return false;
	}

	async IsInvalidNicknameChars(nickname: string) {
		var pattern = new RegExp(/[~`@^!#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/); //unacceptable chars
		if (pattern.test(nickname))
			return true;
		return false;
	}

	async wonCount(userId: number): Promise<number> {
		const user = await this.userRepository.findOne({
			where: { id: userId },
			relations: ['won'],
		});
		return user.won.length;
	}

	async lostCount(userId: number) {
		const user = await this.userRepository.findOne({
			where: { id: userId },
			relations: ['lost'],
		});
		return user.lost.length;
	}

	async fetchMatch(user: User) {
		const matches = await this.matchService.getAll(user);
		const matchList = await Promise.all(matches.map(async match => {
			const result: string = `${match.winner.nickname}(${match.winnerScore}) : ${match.loser.nickname}(${match.loserScore})`;
			return result;
		}, []));

		const WonCount = await this.wonCount(user.id);
		const LostCount = await this.lostCount(user.id);

		const matchWithProfile = {
			id: user.id,
			nickname: user.nickname,
			match: matchList,
			won: WonCount,
			lost: LostCount,
			ladder: user.ladder,
			achievement: user.achievement,
		}
		return matchWithProfile;
	}
}
