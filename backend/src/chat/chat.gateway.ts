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
	private sockets = new Map< number, { socket: AuthSocket; channels: number[] } >();

	async broadcast(userId: number, userName: string, channelId: number, message: string) {
		try{
			const sockets = this.sockets.values();
			const users = Array.from(sockets)
			.filter(({ channels }) => channels.includes(channelId));
			users.map((u) => console.log(u.socket.user.nickname));
			const nonBlockUsers = users.filter(({ socket }) => socket.user.blocks.includes(userId) == false);
			nonBlockUsers.map(({ socket }) => socket.emit('message', { channel: channelId, message: message, userId: userId, userName: userName }))
		}
		catch {}
	}

	async dm(userId: number, userName: string, otherUserId: number, message: string) {
		try{
			const sockets = this.sockets.values();
			console.log("message : ", message);
			const users = Array.from(sockets)
			.filter(({ socket }) => socket.user.id == userId || socket.user.id == otherUserId)
			console.log("userId : ", userId);
			console.log("otherUserId : ", otherUserId);
			users.map(({ socket }) => {
				console.log("socket : ", socket.user.id);
				if (socket.user.id == userId) {
					socket.emit('direct-message', { channel: otherUserId, message: message, userId: userId, userName: userName })
				}
				else if (socket.user.id == otherUserId) {
					socket.emit('direct-message', { channel: userId, message: message, userId: userId, userName: userName })
				}
			})
		}
		catch {}
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
		this.sockets.set(socket.user.id, { socket, channels: ids });
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
		const messages = await this.chatService.getAllMessages(data);
		if (messages){
			const message_list = messages.map(({ message, user }) => ({ message, userId: user.id, userName: user.nickname }))
			.filter(({ userId }) => socket.user.blocks.includes(userId) == false);
			socket.emit('all-message', { channel: data, messages: message_list });
		}
	}

	@SubscribeMessage('all-direct-message')
	async allDirectMessage(@ConnectedSocket() socket: AuthSocket, @MessageBody() data: { userId: number, otherUserId: number },) {
		const messages = await this.chatService.getAllDirectMessages(data.userId, data.otherUserId);
		console.log("메세지 :", messages);
		if (messages){
			const message_list = messages.map(({ message, user }) => ({ message, userId: user.id, userName: user.nickname }))
			.filter(({ userId }) => socket.user.blocks.includes(userId) == false);
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
			const sockets = this.sockets.values();
			const users = Array.from(sockets)
			users.forEach(async ({ socket }) => await this.allChannelList(socket));
		}
		catch {}
	}

	@SubscribeMessage('join-dm')
	async handleCreateDM(
		@MessageBody() data: { userId: number, otherUserId: number },
	){
		try {
			await this.chatService.joinDMChannel(data.userId, data.otherUserId);
		}
		catch {}
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
			socket.emit('notify', response.message);
			await this.broadcast(socket.user.id, socket.user.nickname, data.id, `${socket.user.nickname} joined the channel`);
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
				socket.emit('leave', "성공적으로 채널을 나갔습니다.");

				const sockets = this.sockets.values();
				const users = Array.from(sockets)
				users.forEach(async ({ socket }) => {
					await this.allChannelList(socket);
					await this.channelList(socket);
				});
			}
			catch {}
	}

	/********************  HANDLE MESSAGE  ********************/

	@SubscribeMessage('message')
	async handleMessage(
		@MessageBody() data: { channel: number, message: string },
		@ConnectedSocket() socket: AuthSocket,
		){
			try {
				const channel = await this.chatService.getChannel(data.channel);
				if ((channel.users.find((u) => u.id === socket.user.id)) === undefined){
					socket.emit('error', "채널에 참여중이지 않습니다.");
					return;
				}
				if (channel.mutes.includes(socket.user.id)){
					socket.emit('error', "채널에서 mute되었습니다.");
					return;
				}
				await this.chatService.addChannelMessage({
					message: data.message,
					user: socket.user,
				}, channel);
				await this.broadcast(socket.user.id, socket.user.nickname, data.channel, data.message);
			}
			catch {}
	}

	/********************  HANDLE MESSAGE  ********************/

	@SubscribeMessage('direct-message')
	async handleDirectMessage(
		@MessageBody() data: { userId: number, otherUserId: number, message: string },
		@ConnectedSocket() socket: AuthSocket,
		){
			try {
				const otherUser = await this.userService.getOne(data.otherUserId);
				if (otherUser.blocks.includes(socket.user.id)){
					socket.emit('error', "상대방이 당신을 차단했습니다.");
					return;
				}
				console.log("메세지 전송 받음 :", data.message);
				await this.chatService.addDirectMessage({
					message: data.message,
					user: socket.user,
				}, data.userId, data.otherUserId);

				await this.dm(data.userId, socket.user.nickname ,data.otherUserId, data.message);
			}
			catch {}
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
					const response = await this.chatService.kickUser(data.user, data.channel);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} kicked ${data.user}`);
					await this.channelList(this.sockets.get(data.user).socket);
				}
				else if (data.type === 'mute') {
					const response = await this.chatService.muteUser(data.user, data.channel);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} muted ${data.user}`);
				}
				else if (data.type === 'unmute') {
					const response = await this.chatService.unmuteUser(data.user, data.channel);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} unmuted ${data.user}`);
				}
				else if (data.type === 'ban') {
					const response = await this.chatService.banUser(data.user, data.channel);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} banned ${data.user}`);
					await this.channelList(this.sockets.get(data.user).socket);
				}
				else if (data.type === 'add-admin') {
					const response = await this.chatService.addAdmin(data.user, data.channel);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} added ${data.user} as admin`);
				}
				else if (data.type === 'remove-admin') {
					const response = await this.chatService.removeAdmin(data.user, data.channel);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} removed ${data.user} as admin`);
				}
				else if (data.type === 'change-password') {
					const response = await this.chatService.changeChannelPassword(data.channel, data.isPrivate, data.password);
					if (response.status === false) {
						socket.emit('error', response.message);
						return;
					}
					socket.emit('notify', response.message);
					await this.broadcast(socket.user.id, socket.user.nickname, data.channel, `${socket.user.nickname} changed password`);
				}
				Array.from(this.sockets.values()).map((u) => {
					if (u.channels.includes(data.channel))
						this.allChannelList(u.socket);
						this.channelList(u.socket);
				});

				this.handleChannelUserList(data.channel, socket);
			}
			catch {}
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
			catch {}
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
		catch {}
	}

	@SubscribeMessage('blocks')
	async handleBlocks(
		@MessageBody() data: number,
		@ConnectedSocket() socket: AuthSocket,
	){
		if (socket.user.id === data)
			socket.emit('error', "자신은 block할 수 없습니다.");
		else if (socket.user.blocks.includes(data))
			socket.emit('error', "이미 block되었습니다.");
		socket.user.blocks.push(data);
		await this.userService.update(socket.user.id, socket.user);
		socket.emit('notify', "해당 유저를 block했습니다.");
	}

	/********************  HANDLE CONNECTION  ********************/

	afterInit(server: Server) {
		const middle = WSAuthMiddleware(this.jwtService, this.userService);
		server.use(middle);
		console.log(`WS ${ChatGateway.name} init`);
	}

	async handleConnection(@ConnectedSocket() socket: AuthSocket, ...args: any[]) {
		if (!socket.user) return;
		await this.channelList(socket);
		await this.userList(socket);
	}

	async handleDisconnect(@ConnectedSocket() diconnSocket: AuthSocket) {
		if (!diconnSocket.user) return;
	}
}
