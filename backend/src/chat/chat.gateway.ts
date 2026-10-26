import {
	ConnectedSocket,
	OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
	SubscribeMessage,
	MessageBody,
	OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UserService } from 'src/user/user.service';
import { ChatService } from './chat.service';
import { AuthSocket, WSAuthMiddleware } from './chat.middleware';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { JoinChannelDto } from './dto/join-channel.dto';
import { UserStatus } from 'src/user/interface/user.status';


@WebSocketGateway({
	cors: {
		origin: "*",
		allowedHeaders: ["authorization"]
	},
	namespace: '/chat',
	pingInterval: 10000,
	pingTimeout: 5000,
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
	constructor(
		private readonly userService: UserService,
		private chatService: ChatService,
		@Inject(JwtService)
		private readonly jwtService: JwtService,
	) { }
	@WebSocketServer() server: Server;
	private channelRoom(id: number): string { return `channel:${id}`; }
	private userRoom(id: number): string { return `user:${id}`; }

	/** Invalidate channel lists on all connected nodes after a DB mutation. */
	private notifyChannelChanges(): void {
		this.server.emit('channel-lists-stale');
	}

	async broadcast(userId: number, userName: string, channelId: number, message: string) {
		const channel = await this.chatService.getChannelMembership(channelId);
		if (!channel) return;
		// Authorize recipients from the database, never a possibly stale channel
		// room. A union of authenticated user rooms reaches every device on every
		// node without a fetchSockets RPC (which can time out after a DB save).
		const recipients = [...new Set(channel.users
			.filter((member) => !member.blocks.includes(userId))
			.map((member) => this.userRoom(member.id)))];
		if (recipients.length === 0) return;
		this.server.to(recipients).emit('message', {
			channel: channelId, message, userId, userName,
		});
	}

	async dm(userId: number, userName: string, otherUserId: number, message: string) {
		this.server.to(this.userRoom(userId)).emit('direct-message', {
			channel: otherUserId, message, userId, userName,
		});
		this.server.to(this.userRoom(otherUserId)).emit('direct-message', {
			channel: userId, message, userId, userName,
		});
	}

	/********************  HANDLE CHANNEL  ********************/

	@SubscribeMessage('user-list')
	async userList(@ConnectedSocket() socket: AuthSocket) {
		const user_list = await this.chatService.getAllUsers(socket.user.id);
		socket.emit('user-list', user_list);
	}

	@SubscribeMessage('channel-list')
	async channelList(@ConnectedSocket() socket: AuthSocket) {
		const channels = await this.chatService.getChannelsForUser(socket.user.id);
		const channel_list = channels.map(({ id, name, admins, owner }) => ({ id, name, admins, owner }));
		const ids = channels.map(({ id }) => id);
		const previous = (socket.data.channels as number[] || []);
		await Promise.all(previous.filter((id) => !ids.includes(id))
			.map((id) => socket.leave(this.channelRoom(id))));
		await Promise.all(ids.map((id) => socket.join(this.channelRoom(id))));
		socket.data.channels = ids;
		socket.emit('channel-list', channel_list);
	}

	@SubscribeMessage('all-channel-list')
	async allChannelList(@ConnectedSocket() socket: AuthSocket) {
		const channels = await this.chatService.getAllChannels();
		const channel_list = channels.map(({ id, name, isPrivate }) => ({ id, name, isPrivate }));
		socket.emit('all-channel-list', channel_list);
	}

	@SubscribeMessage('all-message')
	async allMessage(@ConnectedSocket() socket: AuthSocket, @MessageBody() data: number) {
		const channel = await this.chatService.getChannelMembership(data);
		if (!channel?.users.some((user) => user.id === socket.user.id)) {
			socket.emit('error', '채널에 참여중이지 않습니다.');
			return;
		}
		const blocks = await this.userService.fetchBlocks(socket.user.id);
		const messages = await this.chatService.getAllMessages(data);
		if (messages){
			const message_list = messages.map(({ message, user }) => ({ message, userId: user.id, userName: user.nickname }))
			.filter(({ userId }) => !blocks.includes(userId));
			socket.emit('all-message', { channel: data, messages: message_list });
		}
	}

	@SubscribeMessage('all-direct-message')
	async allDirectMessage(@ConnectedSocket() socket: AuthSocket, @MessageBody() data: { userId: number, otherUserId: number },) {
		const messages = await this.chatService.getAllDirectMessages(socket.user.id, data.otherUserId);
		const blocks = await this.userService.fetchBlocks(socket.user.id);
		if (messages){
			const message_list = messages.map(({ message, user }) => ({ message, userId: user.id, userName: user.nickname }))
			.filter(({ userId }) => !blocks.includes(userId));
			socket.emit('all-direct-message', { channel: data.otherUserId, messages: message_list });
		}
	}

	@SubscribeMessage('create')
	async handleCreate(
		@MessageBody() data: CreateChannelDto,
		@ConnectedSocket() socket: AuthSocket,
	){
		try {
			const response = await this.chatService.createChannel(data, socket.user.id);
			if (response.status === false) {
				socket.emit('error', response.message);
				return;
			}
			socket.emit('notify', response.message);
			await this.channelList(socket);
			this.notifyChannelChanges();
		}
		catch { socket.emit('error', '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
	}

	@SubscribeMessage('join-dm')
	async handleCreateDM(
		@MessageBody() data: { userId: number, otherUserId: number },
		@ConnectedSocket() socket: AuthSocket,
	){
		try {
			await this.chatService.joinDMChannel(socket.user.id, data.otherUserId);
		}
		catch { socket.emit('error', '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
	}

	@SubscribeMessage('join')
	async handleJoin(
		@MessageBody() data: JoinChannelDto ,
		@ConnectedSocket() socket: AuthSocket,
		){
			const response = await this.chatService.joinChannel(data.id, socket.user.id, data.password);
			if (response.status === false) {
				socket.emit('error', response.message);
				return;
			}
			await this.channelList(socket);
			this.server.in(this.userRoom(socket.user.id)).socketsJoin(this.channelRoom(data.id));
			socket.emit('notify', response.message);
			await this.broadcast(socket.user.id, socket.user.nickname, data.id, `${socket.user.nickname} joined the channel`);
			this.notifyChannelChanges();
	}

	@SubscribeMessage('leave')
	async handleLeave(
		@MessageBody() data: number,
		@ConnectedSocket() socket: AuthSocket,
		){
			try {
				if (await this.chatService.removeUser(socket.user.id, data) === false) {
					socket.emit('error', "채널에 참여중이지 않습니다.");
					return;
				}
				await this.broadcast(socket.user.id, socket.user.nickname, data, `${socket.user.id} left the channel`);
				this.server.in(this.userRoom(socket.user.id)).socketsLeave(this.channelRoom(data));
				await this.channelList(socket);
				socket.emit('leave', "성공적으로 채널을 나갔습니다.");

				this.notifyChannelChanges();
			}
			catch { socket.emit('error', '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
	}

	/********************  HANDLE MESSAGE  ********************/

	@SubscribeMessage('message')
	async handleMessage(
		@MessageBody() data: { channel: number, message: string },
		@ConnectedSocket() socket: AuthSocket,
		){
			try {
				const channel = await this.chatService.getChannel(data.channel);
				if (!channel?.users.some((u) => u.id === socket.user.id)){
					socket.emit('error', "채널에 참여중이지 않습니다.");
					return;
				}
				if (channel.mutes.includes(socket.user.id)){
					socket.emit('error', "채널에서 mute되었습니다.");
					return;
				}
				const saved = await this.chatService.addChannelMessage({
					message: data.message,
					user: socket.user,
				}, channel);
				if (!saved.status) { socket.emit('error', saved.message); return; }
				await this.broadcast(socket.user.id, socket.user.nickname, data.channel, data.message);
			}
			catch { socket.emit('error', '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
	}

	/********************  HANDLE MESSAGE  ********************/

	@SubscribeMessage('direct-message')
	async handleDirectMessage(
		@MessageBody() data: { userId: number, otherUserId: number, message: string },
		@ConnectedSocket() socket: AuthSocket,
		){
			try {
				if (data.userId !== socket.user.id) {
					socket.emit('error', '보낸 사람의 인증 정보가 일치하지 않습니다.');
					return;
				}
				const otherUser = await this.userService.getOne(data.otherUserId);
				if (!otherUser) return;
				if (otherUser.blocks.includes(socket.user.id)){
					socket.emit('error', "상대방이 당신을 차단했습니다.");
					return;
				}
				await this.chatService.addDirectMessage({
					message: data.message,
					user: socket.user,
				}, data.userId, data.otherUserId);

				await this.dm(data.userId, socket.user.nickname ,data.otherUserId, data.message);
			}
			catch { socket.emit('error', '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
	}

	/********************  HANDLE ADMIN  ********************/

	@SubscribeMessage('admin')
	async handleAdmin(
		@MessageBody() data: { channel: number, user: number, type: string, isPrivate: boolean, password: string},
		@ConnectedSocket() socket: AuthSocket,
		){
			try {
				const isAdmin = await this.chatService.checkAdmin(socket.user.id, data.user, data.channel);
				if (isAdmin.status === false) {
					socket.emit('error', "관리자가 아닙니다.");
					return;
				}
				if (data.type === 'kick') {
					const response = await this.chatService.kickUser(data.user, data.channel, socket.user.id);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					this.server.in(this.userRoom(data.user)).socketsLeave(this.channelRoom(data.channel));
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} kicked ${data.user}`);
					this.notifyChannelChanges();
				}
				else if (data.type === 'mute') {
					const response = await this.chatService.muteUser(data.user, data.channel, socket.user.id);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} muted ${data.user}`);
				}
				else if (data.type === 'unmute') {
					const response = await this.chatService.unmuteUser(data.user, data.channel, socket.user.id);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} unmuted ${data.user}`);
				}
				else if (data.type === 'ban') {
					const response = await this.chatService.banUser(data.user, data.channel, socket.user.id);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					this.server.in(this.userRoom(data.user)).socketsLeave(this.channelRoom(data.channel));
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} banned ${data.user}`);
					this.notifyChannelChanges();
				}
				else if (data.type === 'add-admin') {
					const response = await this.chatService.addAdmin(data.user, data.channel, socket.user.id);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} added ${data.user} as admin`);
				}
				else if (data.type === 'remove-admin') {
					const response = await this.chatService.removeAdmin(data.user, data.channel, socket.user.id);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} removed ${data.user} as admin`);
				}
				else if (data.type === 'change-password') {
					const response = await this.chatService.changeChannelPassword(data.channel, data.isPrivate, data.password, socket.user.id);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} changed password`);
				}
				this.notifyChannelChanges();

				this.handleChannelUserList(data.channel, socket);
			}
			catch { socket.emit('error', '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
		}

	@SubscribeMessage('channelUserList')
	async handleChannelUserList(
		@MessageBody() data: number,
		@ConnectedSocket() socket: AuthSocket,
		){
			try {
				const users = await this.chatService.getChannelUsers(data, socket.user.id);
				socket.emit('channelUserList', users);
			}
			catch { socket.emit('error', '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
		}

	@SubscribeMessage('reset')
	async reset(
		@ConnectedSocket() socket: AuthSocket,
	){
		try {
			if (!socket.user) return;
			await this.channelList(socket);
			await this.userList(socket);
		}
		catch { socket.emit('error', '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
	}

	@SubscribeMessage('blocks')
	async handleBlocks(
		@MessageBody() data: number,
		@ConnectedSocket() socket: AuthSocket,
	){
		try {
			const user = await this.userService.addBlock(socket.user.id, data);
			socket.user.blocks = user.blocks;
			socket.data.blocks = [...user.blocks];
			socket.emit('notify', "해당 유저를 block했습니다.");
		} catch (error) {
			socket.emit('error', error.message || '차단 요청을 처리할 수 없습니다.');
		}
	}

	/********************  HANDLE CONNECTION  ********************/

	afterInit(server: Server) {
		const middle = WSAuthMiddleware(this.jwtService, this.userService);
		server.use(middle);
		console.log(`WS ${ChatGateway.name} init`);
	}

	async handleConnection(@ConnectedSocket() socket: AuthSocket, ...args: any[]) {
		if (!socket.user) return;
		socket.data.userId = socket.user.id;
		socket.data.blocks = [...socket.user.blocks];
		await socket.join(this.userRoom(socket.user.id));
		await this.channelList(socket);
		await this.userList(socket);
		this.server.emit('users-list-stale');
	}

	async handleDisconnect(@ConnectedSocket() diconnSocket: AuthSocket) {
		if (!diconnSocket.user) return;
		this.server.emit('users-list-stale');
	}
}
