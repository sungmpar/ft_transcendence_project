import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from './entity/channel.entity';
import { DMChannel } from './entity/dm-channel.entity';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { Message } from './entity/message.entity';
import { ChannelI } from './channel.interface';
import { MessageI } from './message.interface';
import { dmUsers } from './interface/dm-users';


@Injectable()
export class ChatService {
	constructor(
		@InjectRepository(Channel)
		private readonly channelRepository: Repository<Channel>,
		@InjectRepository(DMChannel)
		private readonly DMChannelRepository: Repository<DMChannel>,
		@InjectRepository(Message)
		private readonly messageRepository: Repository<Message>,
		@Inject(UserService)
    private readonly userService: UserService,
	) { }

	/********************  Channel  ********************/

	async createChannel(channel: ChannelI, userId: number) {
		if (typeof channel?.name !== 'string' || typeof channel.password !== 'string' || typeof channel.isPrivate !== 'boolean')
			return { status: false, message: '채널 설정이 잘못되었습니다.' };
		const name = channel.name.replace(/\s+/g, '');
		const invalidName = /[~`@^!#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/;
		if (name.length < 1 || name.length > 12)
			return { status: false, message: '채널 이름은 1글자 이상, 12글자 이하입니다.' };
		if (invalidName.test(name)) return { status: false, message: '채널 이름은 특수문자를 포함할수 없습니다.' };
		if (channel.isPrivate && !channel.password) return { status: false, message: '비밀번호를 입력해 주세요.' };
		const user = await this.userService.getOne(userId);
		if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
		const password = channel.isPrivate ? await bcrypt.hash(channel.password, 10) : '';
		return this.channelRepository.manager.transaction(async (manager) => {
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', ['ft:channel', name]);
			const repository = manager.getRepository(Channel);
			if (await repository.findOne({ where: { name } }))
				return { status: false, message: '이미 존재하는 채널 이름입니다.' };
			await repository.save(repository.create({ name, password, isPrivate: channel.isPrivate, owner: userId, users: [user] }));
			return { status: true, message: '채널이 생성되었습니다.' };
		});
	}

	async createDMChannel(userId: number, otherUserId: number) {
		return this.joinDMChannel(userId, otherUserId);
	}

	async changeChannelPassword(channelId: number, isPrivate: boolean, password: string, actorId: number) {
		if (isPrivate && !password) return { status: false, message: '비밀번호를 입력해 주세요.' };
		const hashed = isPrivate ? await bcrypt.hash(password, 10) : '';
		return this.withLockedChannel(channelId, async (channel, repository) => {
			if (!this.canModerate(channel, actorId)) return { status: false, message: '관리자 권한이 없습니다.' };
			if (!channel) return { status: false, message: '채널이 존재하지 않습니다.' };
			await repository.update(channelId, { password: hashed, isPrivate });
			return { status: true, message: '비밀번호가 변경되었습니다.' };
		});
	}

	async joinChannel(channelId: number, userId: number, password: string) {
		return this.withLockedChannel(channelId, async (channel, repository) => {
			if (!channel) return { status: false, message: '채널이 존재하지 않습니다.' };
			if (channel.bans.includes(userId)) return { status: false, message: '채널에서 ban되었습니다.' };
			if (channel.isPrivate && !await bcrypt.compare(password || '', channel.password))
				return { status: false, message: '비밀번호가 틀렸습니다.' };
			if (channel.users.some((user) => user.id === userId)) return { status: false, message: '이미 채널에 참여중입니다.' };
			await repository.createQueryBuilder().relation(Channel, 'users').of(channelId).add(userId);
			return { status: true, message: '성공적으로 가입했습니다.' };
		});
	}

	async joinDMChannel(userId: number, otherUserId: number) {
		if (!Number.isSafeInteger(userId) || !Number.isSafeInteger(otherUserId) || userId === otherUserId)
			throw new HttpException('Invalid direct message participant', HttpStatus.BAD_REQUEST);
		const [user, otherUser] = await Promise.all([
			this.userService.getOne(userId), this.userService.getOne(otherUserId),
		]);
		if (!user || !otherUser) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
		// The same conversation can be opened on independent Vercel instances.
		// Serialize only this pair, using the shared database transaction boundary.
		return this.DMChannelRepository.manager.transaction(async (manager) => {
			const pair = [userId, otherUserId].sort((a, b) => a - b).join(':');
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', ['ft:dm', pair]);
			const repository = manager.getRepository(DMChannel);
			const existing = await this.findDMChannel(repository, userId, otherUserId);
			if (existing) return existing;
			return repository.save(repository.create({ users: [user, otherUser] }));
		});
	}

	async deleteChannel(channelId: number) {
		try
		{
			const channel = await this.getChannel(channelId);
			if (!channel)
				throw new HttpException('Channel not found', HttpStatus.NOT_FOUND);
			await this.channelRepository.delete(channelId);
			return true;
		}
		catch {}
	}

	async getAllChannels() {
		const channels = await this.channelRepository.createQueryBuilder('channel')
		.where('channel.isDM = false')
		.getMany();
		channels.forEach((chat) => delete chat.password);
		return channels;
	}

	async getChannelsForUser(userId: number) {
		const channels = await this.channelRepository
		.createQueryBuilder('channel')
		.leftJoinAndSelect('channel.users', 'users')
		.where('users.id = :userId', { userId })
		.getMany();
		channels.forEach((chat) => delete chat.password);
		return channels;
	}

	async getDMChannelsForUser(userId: number) {
		const channels = await this.DMChannelRepository
		.createQueryBuilder('channel')
		.innerJoin('channel.users', 'membership', 'membership.id = :userId', { userId })
		.leftJoinAndSelect('channel.users', 'users')
		.leftJoinAndSelect('channel.messages', 'messages')
		.leftJoinAndSelect('messages.user', 'author')
		.orderBy('messages.id', 'ASC')
		.getMany();
		return channels;
	}

	/********************  User  ********************/


	private async withLockedChannel<T>(channelId: number, action: (channel: Channel, repository: Repository<Channel>) => Promise<T>): Promise<T> {
		return this.channelRepository.manager.transaction(async (manager) => {
			const repository = manager.getRepository(Channel);
			const channel = await repository.createQueryBuilder('channel')
				.setLock('pessimistic_write').where('channel.id = :channelId', { channelId }).getOne();
			if (channel) channel.users = await repository.createQueryBuilder().relation(Channel, 'users').of(channelId).loadMany();
			return action(channel, repository);
		});
	}

	private canModerate(channel: Channel, actorId: number, targetId?: number): boolean {
		if (!channel || !channel.users.some((user) => user.id === actorId)) return false;
		if (channel.owner === actorId) return true;
		return channel.admins.includes(actorId) && channel.owner !== targetId && !channel.admins.includes(targetId);
	}

	async addUser(userId: number, channelId: number) {
		return this.withLockedChannel(channelId, async (channel, repository) => {
			if (!channel || channel.bans.includes(userId) || channel.users.some((user) => user.id === userId)) return false;
			await repository.createQueryBuilder().relation(Channel, 'users').of(channelId).add(userId);
			return true;
		});
	}

	async getChannel(channelId: number) {
		if (channelId)
		{
			const channel = await this.channelRepository.findOne({
				where: { id: channelId },
				relations: ['users', 'messages'],
			});
			if (!channel)
				return null;
			return channel;
		}
	}

	async getChannelMembership(channelId: number) {
		if (!Number.isSafeInteger(channelId) || channelId <= 0) return null;
		return this.channelRepository.findOne({ where: { id: channelId }, relations: ['users'] });
	}

	async getDMChannel(userId: number, otherUserId: number) {
		return this.findDMChannel(this.DMChannelRepository, userId, otherUserId);
	}

	private findDMChannel(repository: Repository<DMChannel>, userId: number, otherUserId: number) {
		return repository.createQueryBuilder('conversation')
			.innerJoin('conversation.users', 'first', 'first.id = :userId', { userId })
			.innerJoin('conversation.users', 'second', 'second.id = :otherUserId', { otherUserId })
			.leftJoinAndSelect('conversation.users', 'users')
			.leftJoinAndSelect('conversation.messages', 'messages')
			.leftJoinAndSelect('messages.user', 'author')
			.orderBy('conversation.id', 'ASC').addOrderBy('messages.id', 'ASC')
			.getOne();
	}


	async removeUser(userId: number, channelId: number) {
		return this.withLockedChannel(channelId, async (channel, repository) => {
			if (!channel || !channel.users.some((user) => user.id === userId)) return false;
			const remaining = channel.users.filter((user) => user.id !== userId);
			if (!remaining.length) {
				await repository.delete(channelId);
				return true;
			}
			const admins = channel.admins.filter((id) => id !== userId);
			const owner = channel.owner === userId ? (admins.find((id) => remaining.some((user) => user.id === id)) || remaining[0].id) : channel.owner;
			await repository.createQueryBuilder().relation(Channel, 'users').of(channelId).remove(userId);
			await repository.update(channelId, { owner, admins, mutes: channel.mutes.filter((id) => id !== userId) });
			return true;
		});
	}

	async getAllUsers(userId: number) {
		const [users, channels, blocks] = await Promise.all([
			this.userService.fetchUsers(), this.getDMChannelsForUser(userId), this.userService.fetchBlocks(userId),
		]);
		return users.filter((user) => user.id !== userId).map((user) => {
			const channel = channels.find((channel) => channel.users.some((member) => member.id === user.id));
			const messages = (channel?.messages || []).filter((message) => !blocks.includes(message.user.id))
				.map(({ message, user: author }) => ({ message, userId: author.id, userName: author.nickname }));
			return { id: user.id, name: user.name, status: user.status, messages };
		});
	}

	async checkAdmin(userId: number,otherUserId: number, channelId: number) {
		const channel = await this.getChannel(channelId);
		if (!channel)
			return { status: false, message: "채널이 존재하지 않습니다."};
			if (channel.owner !== userId && channel.admins.includes(userId) == false) {
				return { status: false, message: "관리자가 아닙니다."};
			}
			if (channel.owner !== userId && channel.admins.includes(userId)) {
				if (otherUserId === channel.owner || channel.admins.includes(otherUserId)) {
					return { status: false, message: "관리자는 방장/관리자에게 권한이 없습니다."};
				}
			}
		return { status: true, message: "권한이 있습니다."};
	}


	/********************  Ban  ********************/

	async banUser(userId: number, channelId: number, actorId: number) {
		return this.withLockedChannel(channelId, async (channel, repository) => {
			if (!this.canModerate(channel, actorId, userId)) return { status: false, message: '관리자 권한이 없습니다.' };
			if (!channel || !channel.users.some((user) => user.id === userId)) return { status: false, message: '해당 채널에 참여하지 않았습니다.' };
			if (channel.owner === userId) return { status: false, message: '방장은 차단할 수 없습니다.' };
			await repository.createQueryBuilder().relation(Channel, 'users').of(channelId).remove(userId);
			await repository.update(channelId, { bans: [...new Set([...channel.bans, userId])], admins: channel.admins.filter((id) => id !== userId), mutes: channel.mutes.filter((id) => id !== userId) });
			return { status: true, message: '해당 유저를 차단하였습니다.' };
		});
	}

	async muteUser(userId: number, channelId: number, actorId: number) {
		return this.withLockedChannel(channelId, async (channel, repository) => {
			if (!this.canModerate(channel, actorId, userId)) return { status: false, message: '관리자 권한이 없습니다.' };
			if (!channel || !channel.users.some((user) => user.id === userId)) return { status: false, message: '해당 채널에 참여하지 않았습니다.' };
			await repository.update(channelId, { mutes: [...new Set([...channel.mutes, userId])] });
			return { status: true, message: '해당 유저를 뮤트하였습니다.' };
		});
	}

	async unmuteUser(userId: number, channelId: number, actorId: number) {
		return this.withLockedChannel(channelId, async (channel, repository) => {
			if (!this.canModerate(channel, actorId, userId)) return { status: false, message: '관리자 권한이 없습니다.' };
			if (!channel || !channel.users.some((user) => user.id === userId)) return { status: false, message: '해당 채널에 참여하지 않았습니다.' };
			await repository.update(channelId, { mutes: channel.mutes.filter((id) => id !== userId) });
			return { status: true, message: '해당 유저의 뮤트를 해제하였습니다.' };
		});
	}

	async addAdmin(userId: number, channelId: number, actorId: number) {
		return this.withLockedChannel(channelId, async (channel, repository) => {
			if (!this.canModerate(channel, actorId, userId)) return { status: false, message: '관리자 권한이 없습니다.' };
			if (!channel || !channel.users.some((user) => user.id === userId)) return { status: false, message: '해당 채널에 참여하지 않았습니다.' };
			await repository.update(channelId, { admins: [...new Set([...channel.admins, userId])] });
			return { status: true, message: '해당 유저를 관리자로 추가하였습니다.' };
		});
	}

	async removeAdmin(userId: number, channelId: number, actorId: number) {
		return this.withLockedChannel(channelId, async (channel, repository) => {
			if (!this.canModerate(channel, actorId, userId)) return { status: false, message: '관리자 권한이 없습니다.' };
			if (!channel || !channel.users.some((user) => user.id === userId)) return { status: false, message: '해당 채널에 참여하지 않았습니다.' };
			await repository.update(channelId, { admins: channel.admins.filter((id) => id !== userId) });
			return { status: true, message: '해당 유저를 관리자에서 제거하였습니다.' };
		});
	}

	async getChannelUsers(channelId: number, userId: number) {
		const channel = await this.getChannelMembership(channelId);
		if (!channel || !channel.users.some((user) => user.id === userId))
			throw new HttpException('Channel membership required', HttpStatus.FORBIDDEN);
		return {
			channelId: channel.id,
			channelOwner: channel.owner,
			channelUsers: channel.users.filter((user) => user.id !== userId).map((user) => ({
				id: user.id, name: user.nickname,
				isOwner: user.id === channel.owner,
				isAdmin: channel.admins.includes(user.id),
				isMuted: channel.mutes.includes(user.id),
				isBanned: channel.bans.includes(user.id),
			})),
		};
	}

	/********************  Kick  ********************/

	async kickUser(userId: number, channelId: number, actorId: number) {
		return this.withLockedChannel(channelId, async (channel, repository) => {
			if (!this.canModerate(channel, actorId, userId)) return { status: false, message: '관리자 권한이 없습니다.' };
			if (!channel || !channel.users.some((user) => user.id === userId)) return { status: false, message: '해당 채널에 참여하지 않았습니다.' };
			if (channel.owner === userId) return { status: false, message: '방장은 강퇴할 수 없습니다.' };
			await repository.createQueryBuilder().relation(Channel, 'users').of(channelId).remove(userId);
			await repository.update(channelId, { admins: channel.admins.filter((id) => id !== userId), mutes: channel.mutes.filter((id) => id !== userId) });
			return { status: true, message: '유저를 강퇴하였습니다.' };
		});
	}

	async getAllMessages(channelId: number) {
		const channel = await this.getChannel(channelId);
		if (!channel)
			return null;
		return channel.messages.sort((first, second) => first.id - second.id);
	}

	async getAllDirectMessages(userId: number, otherUserId: number) {
		const channel = await this.getDMChannel(userId, otherUserId);
		if (!channel)
			return null;
		return channel.messages;
	}

	async addChannelMessage(message: MessageI, channel: Channel) {
		if (!channel) return { status: false, message: '채널이 존재하지 않습니다.' };
		return this.withLockedChannel(channel.id, async (current, repository) => {
			if (!current?.users.some((user) => user.id === message.user.id))
				return { status: false, message: '채널에 참여중이지 않습니다.' };
			if (current.mutes.includes(message.user.id)) return { status: false, message: '채널에서 mute되었습니다.' };
			const messages = repository.manager.getRepository(Message);
			const saved = await messages.save(messages.create({ message: message.message, user: message.user }));
			await repository.createQueryBuilder().relation(Channel, 'messages').of(channel.id).add(saved);
			return { status: true, message: '' };
		});
	}

	async addDirectMessage(message: MessageI, userId: number, otherUserId: number) {
		const channel = await this.joinDMChannel(userId, otherUserId);
		await this.DMChannelRepository.manager.transaction(async (manager) => {
			const messages = manager.getRepository(Message);
			const saved = await messages.save(messages.create({ message: message.message, user: message.user }));
			await manager.getRepository(DMChannel).createQueryBuilder()
				.relation(DMChannel, 'messages').of(channel.id).add(saved);
		});
	}
}
