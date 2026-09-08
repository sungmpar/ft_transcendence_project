import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UserService } from 'src/user/user.service';
import { JoinGameDto } from './dto/join-game.dto';
import { SpecDto } from './dto/SpecDto';
import { AuthSocket, WSAuthMiddleware } from './game.middleware';
import { GameService } from './game.service';
import { UserStatus } from 'src/user/interface/user.status';
import { performance } from 'perf_hooks';

@WebSocketGateway({
	cors: {
		origin: "*",
		allowedHeaders: ["authorization"]
	},
	namespace: '/game',
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
	private readonly probeTimes = new WeakMap<AuthSocket, number>();
	constructor(
		private readonly userService: UserService,
		@Inject(JwtService)
		private readonly jwtService: JwtService,
		private readonly gameService: GameService,
	) { }

	@WebSocketServer() server: Server;

	@SubscribeMessage('latencyProbe')
	latencyProbe(@ConnectedSocket() socket: AuthSocket, @MessageBody() data: unknown) {
		if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== 1)
			return;
		const nonce = (data as { nonce?: unknown }).nonce;
		if (!Number.isSafeInteger(nonce) || (nonce as number) < 0)
			return;
		const now = performance.now();
		if (now - (this.probeTimes.get(socket) ?? -Infinity) < 1000)
			return;
		this.probeTimes.set(socket, now);
		return { nonce };
	}

	@SubscribeMessage('keyboardEvent')
	keyboardEvent(@ConnectedSocket() socket: AuthSocket, @MessageBody() data: unknown) {
		this.gameService.listenKeyEvent(socket, data);
	}

	@SubscribeMessage('matchmaking')
	async joinMatch(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: JoinGameDto): Promise<void> {
			this.gameService.joinMatch(socket, data);
	}

	@SubscribeMessage('invitelist')
	async inviteList(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: JoinGameDto): Promise<void> {
			this.gameService.userInviteList(socket);
	}


	@SubscribeMessage('invite')
	async invite(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: JoinGameDto): Promise<void> {
			this.gameService.invite(socket, data);
	}

	@SubscribeMessage('joinFriend')
	async joinToFriend(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: number): Promise<void> {
			this.gameService.joinToFriend(socket, data);
	}

	@SubscribeMessage('refuse')
	async refuse(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: unknown): Promise<void> {
			this.gameService.refuse(socket, data);
	}

	@SubscribeMessage('spectate')
	async spectate(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: SpecDto): Promise<void> {
			this.gameService.spectate(socket, data);
	}

	@SubscribeMessage('roomlist')
	async roomList(
		@ConnectedSocket() socket: AuthSocket): Promise<void> {
			this.gameService.spectatorList(socket);
	}

	@SubscribeMessage('achievement')
	async ahievement(
		@ConnectedSocket() socket: AuthSocket): Promise<void> {
			await this.gameService.achievement(socket);
	}


	@SubscribeMessage('end')
	async dropUser(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: JoinGameDto): Promise<void> {
			await this.gameService.dropUser(socket);
	}

	afterInit(server: Server) {
			const middle = WSAuthMiddleware(this.jwtService, this.userService);
			server.use(middle);
	}

	async handleConnection(@ConnectedSocket() socket: AuthSocket, ...args: any[]) {
			this.gameService.addUser(socket);
	}

	async handleDisconnect(@ConnectedSocket() socket: AuthSocket, ...args: any[]) {
			await this.gameService.dropUser(socket, true);
	}
}
