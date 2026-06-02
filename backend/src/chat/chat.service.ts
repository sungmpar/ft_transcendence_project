import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
		const user = await this.userService.getOne(userId);
		var pattern = new RegExp(/[~`@^!#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/);
		channel.name = channel.name.replace(/\s+/g, '');
		if (channel.name.length < 1 || channel.name.length > 12)
			return { status: false, message: "채널 이름은 1글자 이상, 12글자 이하입니다."};
		if (await this.channelRepository.findOne({ where: { name: channel.name }}))
			return { status: false, message: "이미 존재하는 채널 이름입니다."};
		if (pattern.test(channel.name))
			return { status: false, message: "채널 이름은 특수문자를 포함할수 없습니다."};
		if (channel.password.length > 0 && channel.isPrivate)
		{
			try {
				const hashedPassword = bcrypt.hashSync(channel.password, 10);
				channel.password = hashedPassword;
			}
			catch (e) {
				return { status: false, message: "비밀번호가 잘못되었습니다."};
			}
		}
		channel.owner = user.id;
		channel.users = [user];
		await this.channelRepository.save(channel);
		return { status: true, message: "채널이 생성되었습니다." };
	}

	async createDMChannel(userId: number, otherUserId: number) {
		const user = await this.userService.getOne(userId);
		const otherUser = await this.userService.getOne(otherUserId);
		const channel = this.DMChannelRepository.create({
			users: [user, otherUser],
		});
		return this.DMChannelRepository.save(channel);
	}

	async changeChannelPassword(channelId: number, isPrivate: boolean, password: string) {
		const channel = await this.getChannel(channelId);
		if (!channel)
			return ;
		if (password.length > 0 && isPrivate)
		{
			try {
				const hashedPassword = bcrypt.hashSync(password, 10);
				channel.password = hashedPassword;
				channel.isPrivate = true;
			}
			catch (e) {
				return { status: false, message: "비밀번호가 잘못되었습니다."};
			}
		}
		else if (!isPrivate)
		{
			channel.password = '';
			channel.isPrivate = false;
		}
			await this.channelRepository.save(channel);
			return { status: true, message: "비밀번호가 변경되었습니다."};
		}

	async joinChannel(channelId: number, userId: number, password: string) {
		const channel = await this.getChannel(channelId);

		if (channel.bans.includes(userId)){
			return { status: false, message: "채널에서 ban되었습니다."};
		}
		if (channel.isPrivate && !bcrypt.compareSync(password, channel.password)) {
			return { status: false, message: "비밀번호가 틀렸습니다."};
		}
		if (await this.addUser(userId, channelId) === false) {
			return { status: false, message: "이미 채널에 참여중입니다."};
		}

		return { status: true, message: "성공적으로 가입했습니다."};
	}

	async joinDMChannel(userId: number, otherUserId: number) {

		const channel = await this.getDMChannel(userId, otherUserId);
		if (channel)
			return ;
		const user = await this.userService.getOne(userId);
		if (!user)
			return;
		const otherUser = await this.userService.getOne(otherUserId);
		if (!otherUser)
			return;
		const newChannel = this.DMChannelRepository.create({
			users: [user, otherUser],
		});
		await this.DMChannelRepository.save(newChannel);
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
		.leftJoinAndSelect('channel.users', 'users')
		.where('users.id = :userId', { userId })
		.getMany();
		return channels;
	}

	/********************  User  ********************/


	async addUser(userId: number, channelId: number) {
		const user = await this.userService.getOne(userId);
		const channel = await this.getChannel(channelId);
		if (!channel)
			return false;
		if (channel.bans.includes(userId))
			return false;
		if (channel.users.find((u) => u.id === userId))
			return false;
		channel.users.push(user);
		await this.channelRepository.save(channel);
		return true;
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

	async getDMChannel(userId: number, otherUserId: number) {
		const user = await this.userService.getOne(userId);
		const otherUser = await this.userService.getOne(otherUserId);
		const userList = [user, otherUser];
		const channels = await this.DMChannelRepository.find({
			where: { users: In([ user ]) },
			relations: ['users', 'messages'],
		});
		const channel = channels.find((c) => {
			const users = c.users.map((u) => u.id);
			return users.includes(userId) && users.includes(otherUserId);
		});
		if (!channel)
			return null;
		return channel;
	}


	async removeUser(userId: number, channelId: number) {
		try
		{
			const channel = await this.getChannel(channelId);
			if (!channel)
				return false;
			if (channel.users.find((u) => u.id === userId) === undefined)
				return false;
			if (channel.admins.includes(userId)) {
				const adminIndex = channel.admins.indexOf(userId);
				channel.admins.splice(adminIndex, 1);
			}
			if (channel.bans.includes(userId)) {
				const banIndex = channel.bans.indexOf(userId);
				channel.bans.splice(banIndex, 1);
			}
			if (channel.mutes.includes(userId)) {
				const muteIndex = channel.mutes.indexOf(userId);
				channel.mutes.splice(muteIndex, 1);
			}
			if (channel.owner === userId && channel.users.length > 1) {
				channel.owner = channel.admins.length === 0 ? channel.users.find((u) => u.id !== userId).id : channel.admins[0];
			}
			channel.users = channel.users.filter((u) => u.id !== userId);
			if (channel.users.length === 0)
				await this.deleteChannel(channelId);
			else
				await this.channelRepository.save(channel);
			return true;
		} catch {}
	}

	async getAllUsers(userId: number) {
		const users = (await this.userService.fetchUsers()).filter((u) => u.id !== userId);
		const userList = await Promise.all(users.map(async (u) => {
			const messages = await this.getAllDirectMessages(userId, u.id)
			if (messages) {
				const message_list = messages.map(({ message, user }) => ({ message, userId: user.id, userName: user.nickname }))
				return {
					id: u.id,
					name: u.name,
					status: u.status,
					messages: message_list
				}
			}
			return {
				id: u.id,
				name: u.name,
				status: u.status,
			}
		}, []));
		return userList;
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

	async banUser(userId: number, channelId: number) {
		try
		{
			const channel = await this.getChannel(channelId);
			if (!channel)
				return { status: false, message: "해당 채널이 존재하지 않습니다."};
			if (channel.users.find((u) => u.id === userId) === undefined)
				return { status: false, message: "해당 채널에 존재하지 않는 유저입니다."};
			if (channel.bans.includes(userId))
				return { status: false, message: "이미 차단된 유저입니다." };
			channel.bans.push(userId);
			channel.users = channel.users.filter((u) => u.id !== userId);
			await this.channelRepository.save(channel);
			return { status: true, message: "해당 유저를 차단하였습니다." };
		} catch {}
	}

	/********************  Mute  ********************/

	async muteUser(userId: number, channelId: number) {
		try
		{
			const channel = await this.getChannel(channelId);
		if (!channel)
			return { status: false, message: "해당 채널이 존재하지 않습니다."};
		if (channel.users.find((u) => u.id === userId) === undefined)
			return { status: false, message: "해당 채널에 참여하지 않았습니다."};
		if (channel.mutes.includes(userId))
			return { status: false, message: "이미 뮤트된 유저입니다."};
		channel.mutes.push(userId);
		await this.channelRepository.save(channel);
		return { status: true, message: "해당 유저를 뮤트하였습니다."};
		} catch {}
	}

	async unmuteUser(userId: number, channelId: number) {
		try
		{
			const user = await this.userService.getOne(userId);
			const channel = await this.getChannel(channelId);
			if (!channel)
				return { status: false, message: "해당 채널이 존재하지 않습니다."};
			if (channel.users.find((u) => u.id === userId) === undefined)
				return { status: false, message: "해당 채널에 참여하지 않았습니다."};
			if (!channel.mutes.includes(userId))
				return { status: false, message: "이미 뮤트가 해제된 유저입니다."};
			const muteIndex = channel.mutes.indexOf(userId);
			channel.mutes.splice(muteIndex, 1);
			await this.channelRepository.save(channel);
			return { status: true, message: "해당 유저의 뮤트를 해제하였습니다."};
		} catch {}
	}

	/********************  Admin  ********************/

	async addAdmin(userId: number, channelId: number) {
		try
		{
			const user = await this.userService.getOne(userId);
			const channel = await this.getChannel(channelId);
		if (!channel)
			return { status: false, message: "해당 채널이 존재하지 않습니다."};
		if (channel.users.find((u) => u.id === userId) === undefined)
			return { status: false, message: "해당 채널에 참여하지 않았습니다."};
		channel.admins.push(userId);
		await this.channelRepository.save(channel);
		return { status: true, message: "해당 유저를 관리자로 추가하였습니다."};
		}
		catch {}
	}

	async removeAdmin(userId: number, channelId: number) {
		try
		{
			const user = await this.userService.getOne(userId);
			const channel = await this.getChannel(channelId);
		if (!channel)
			return { status: false, message: "해당 채널이 존재하지 않습니다."};
		if (channel.users.find((u) => u.id === userId) === undefined)
			return { status: false, message: "해당 채널에 참여하지 않았습니다."};
		const adminIndex = channel.admins.indexOf(userId);
		channel.admins.splice(adminIndex, 1);
		await this.channelRepository.save(channel);
		return { status: true, message: "해당 유저를 관리자에서 제거하였습니다."};
		}
		catch {}
	}

	async getChannelUsers(channelId: number, userId: number) {
		try
		{
			const channel = await this.getChannel(channelId);
			if (!channel)
				return;
			const userList = channel.users.filter((u) => u.id !== userId)
			.map((u) => ({
				id: u.id,
				name: u.nickname,
				isOwner: u.id === channel.owner,
				isAdmin: channel.admins.includes(u.id),
				isMuted: channel.mutes.includes(u.id),
				isBanned: channel.bans.includes(u.id),
			}));
			return {
				channelId: channel.id,
				channelOwner: channel.owner,
				channelUsers: userList,
			};
		}
		catch {}
	}

	/********************  Kick  ********************/

	async kickUser(userId: number, channelId: number) {
		try
		{
			const user = await this.userService.getOne(userId);
			const channel = await this.getChannel(channelId);
		if (!channel)
			return { status: false, message: "해당 채널이 존재하지 않습니다."};
		if (channel.users.find((u) => u.id === userId) === undefined)
			return { status: false, message: "해당 채널에 참여하지 않았습니다."};

		channel.users = channel.users.filter((u) => u.id !== userId);
		await this.channelRepository.save(channel);
		return { status: true, message: "유저를 강퇴하였습니다."};
		}
		catch {}
	}

	/********************  Message  ********************/

	async getAllMessages(channelId: number) {
		const channel = await this.getChannel(channelId);
		if (!channel)
			return null;
		return channel.messages;
	}

	async getAllDirectMessages(userId: number, otherUserId: number) {
		const channel = await this.getDMChannel(userId, otherUserId);
		if (!channel)
			return null;
		return channel.messages;
	}

	async addChannelMessage(message: MessageI, channel: Channel) {
		if (!channel)
			return;
		const new_message = new Message();
		new_message.message = message.message;
		new_message.user = message.user;
		await this.messageRepository.save(new_message);
		await this.channelRepository.createQueryBuilder()
		.relation(Channel, "messages")
		.of(channel)
		.add(new_message);
	}

	async addDirectMessage(message: MessageI, userId: number, otherUserId: number) {
		const channel = await this.getDMChannel(userId, otherUserId);
		if (!channel)
			return;
		const new_message = new Message();
		new_message.message = message.message;
		new_message.user = message.user;
		await this.messageRepository.save(new_message);
		await this.DMChannelRepository.createQueryBuilder()
		.relation(DMChannel, "messages")
		.of(channel)
		.add(new_message);
	}
}
