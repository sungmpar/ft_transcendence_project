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
import { RedisGameCoordinator } from './redis-game-coordinator';

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
		private readonly coordinator: RedisGameCoordinator,
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
		if (this.coordinator.distributed) return this.coordinator.dispatch(socket, 'keyboardEvent', data);
		this.gameService.listenKeyEvent(socket, data);
	}

  @SubscribeMessage('sessionSync')
  sessionSync(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() data: unknown,
  ) {
    if (this.coordinator.distributed) return this.coordinator.dispatch(socket, 'sessionSync', data);
    return this.gameService.syncSession(socket, data);
  }

	@SubscribeMessage('matchmaking')
	async joinMatch(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: JoinGameDto): Promise<void> {
			if (this.coordinator.distributed) return this.coordinator.dispatch(socket, 'matchmaking', data);
			await this.gameService.joinMatch(socket, data);
	}

	@SubscribeMessage('invitelist')
	async inviteList(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: JoinGameDto): Promise<void> {
			if (this.coordinator.distributed) return this.coordinator.dispatch(socket, 'invitelist');
			await this.gameService.userInviteList(socket);
	}


	@SubscribeMessage('invite')
	async invite(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: JoinGameDto): Promise<void> {
			if (this.coordinator.distributed) return this.coordinator.dispatch(socket, 'invite', data);
			await this.gameService.invite(socket, data);
	}

	@SubscribeMessage('joinFriend')
	async joinToFriend(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: number): Promise<void> {
			if (this.coordinator.distributed) return this.coordinator.dispatch(socket, 'joinFriend', data);
			await this.gameService.joinToFriend(socket, data);
	}

	@SubscribeMessage('refuse')
	async refuse(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: unknown): Promise<void> {
			if (this.coordinator.distributed) return this.coordinator.dispatch(socket, 'refuse', data);
			await this.gameService.refuse(socket, data);
	}

	@SubscribeMessage('spectate')
	async spectate(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: SpecDto): Promise<void> {
			if (this.coordinator.distributed) return this.coordinator.dispatch(socket, 'spectate', data);
			await this.gameService.spectate(socket, data);
	}

	@SubscribeMessage('roomlist')
	async roomList(
		@ConnectedSocket() socket: AuthSocket): Promise<void> {
			if (this.coordinator.distributed) return this.coordinator.dispatch(socket, 'roomlist');
			await this.gameService.spectatorList(socket);
	}

	@SubscribeMessage('achievement')
	async ahievement(
		@ConnectedSocket() socket: AuthSocket): Promise<void> {
			if (this.coordinator.distributed) return this.coordinator.dispatch(socket, 'achievement');
			await this.gameService.achievement(socket);
	}


	@SubscribeMessage('end')
	async dropUser(
		@ConnectedSocket() socket: AuthSocket,
		@MessageBody() data: JoinGameDto): Promise<void> {
			if (this.coordinator.distributed) return this.coordinator.dispatch(socket, 'end', data);
			await this.gameService.dropUser(socket);
	}

	afterInit(server: Server) {
			const middle = WSAuthMiddleware(this.jwtService, this.userService);
			server.use(middle);
			this.coordinator.bindServer(server);
	}

	async handleConnection(@ConnectedSocket() socket: AuthSocket, ...args: any[]) {
			if (this.coordinator.distributed) {
				try {
					const established = await this.coordinator.dispatch(socket, 'connect');
					// A transport close permits Socket.IO to retry after a temporary
					// authority/Redis outage. Explicit server disconnect does not.
					if (!established && socket.connected) socket.client.conn.close();
				} catch {
					if (socket.connected) socket.client.conn.close();
				}
				return;
			}
			await this.gameService.addUser(socket);
	}

	async handleDisconnect(@ConnectedSocket() socket: AuthSocket, ...args: any[]) {
			if (this.coordinator.distributed) {
				try { await this.coordinator.dispatch(socket, 'disconnect'); }
				catch { /* Presence expiry performs the same cleanup after recovery. */ }
				return;
			}
			await this.gameService.dropUser(socket, true);
	}
}
