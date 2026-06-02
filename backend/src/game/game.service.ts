import { Inject, Injectable } from '@nestjs/common';
import { JoinGameDto } from './dto/join-game.dto';
import { AuthSocket } from './game.middleware';
import { GameState, Room } from './interface/room.state';
import { Interval } from '@nestjs/schedule'
import { MatchService } from '../user/match.service';
import { UserService } from 'src/user/user.service';
import { SpecData } from './interface/spec.data';
import { SpecDto } from './dto/SpecDto';
import { UserLadder } from 'src/user/interface/user.ladder';

@Injectable()
export class GameService {
	constructor (
		@Inject(MatchService)
    private readonly matchService: MatchService,
		@Inject(UserService)
		private readonly userService: UserService,
	) {}
	private rooms = new Map< string, Room>();
	private waitList: { socket: AuthSocket, mode: boolean }[] = [];
	private inviteList: { from: AuthSocket, to: number, mode: boolean }[] = [];
	private userList: AuthSocket[] = [];

	async addUser(socket: AuthSocket) {
		try{
			this.userList.push(socket);
		} catch (e) {
			socket.emit("error", { message: "유저를 추가할 수 없습니다." });
		}
	}

	async deleteUser(socket: AuthSocket) {
		try{
			const userIndex = this.userList.findIndex(user => user.user.id == socket.user.id);
			this.inviteList.splice(userIndex, 1);
		} catch (e) {
			socket.emit("error", { message: "유저를 지울 수 없습니다." });
		}
	}

	async deleteInviteList(client: AuthSocket) {
		try{
			const inviteListIndex = this.inviteList.findIndex(inviteData => inviteData.to == client.user.id);
			this.inviteList.splice(inviteListIndex, 1);
		} catch (e) {
			client.emit("error", { message: "초대 리스트 오류" });
		}
	}

	async invite(client: AuthSocket, data: JoinGameDto): Promise<void> {
		try {
			if (data.friendId == client.user.id) {
				client.emit("error", { message: "자신은 초대할 수 없습니다." });
				return;
			}

			for (const list of this.inviteList) {
				if (list.from.user.id == client.user.id) {
						client.emit("error", { message: "이미 초대를 진행중입니다." });
					return;
				}
			}

			const tempRoom = Array.from(this.rooms.values()).find(
				room => room.players.find(player => player.user.id == data.friendId))
			if (tempRoom !== undefined) {
				client.emit("error", { message: "이미 게임중인 유저입니다." });
				return;
			}
			this.inviteList.push({from:client, to: data.friendId, mode: data.mode});
			const friend = this.userList.find(user => user.user.id == data.friendId);
			friend.emit("invited", { friendId: client.user.id, friendName: client.user.name });
			client.emit("invite");
		} catch (e) {
			client.emit("error", { message: "초대를 할 수 없습니다." });
		}
	}

	async refuse(client: AuthSocket, data: JoinGameDto): Promise<void> {
		try {
			for (const list of this.inviteList) {
				if (list.to == client.user.id) {
					client.emit("refuse");
					list.from.emit("refuse");
					const inviteListIndex = this.inviteList.findIndex(inviteData => inviteData.to === client.user.id);
					this.inviteList.splice(inviteListIndex, 1);
					return;
				}
			}
			client.emit("error", { message: "존재하지 않는 방입니다." });
		} catch (e) {
			client.emit("error", { message: "거절 중 오류가 발생하였습니다." });
		}
	}

	async userInviteList(client: AuthSocket): Promise<void> {
		try {
			const userInviteList = [];
			for (const list of this.inviteList) {
				if (list.to == client.user.id) {
					userInviteList.push({
						inviteId: list.from.user.id,
						inviteName: list.from.user.nickname,
					});
				}
			}
			client.emit("userInviteList", { userInviteList: userInviteList });
		} catch {}
	}

	async joinMatch(client: AuthSocket, data: JoinGameDto): Promise<void> {
		try {
			const tempRoom = Array.from(this.rooms.values()).find(
				room => room.players.find(
					player => player.user.id == client.user.id)
			)
			if (tempRoom)
				return;
			let roomIndex: string = null;
			for (const waitSocket of this.waitList) {
				if (waitSocket.socket.user.id == client.user.id) {
					return;
				}
			}
			const otherUser = this.waitList.pop();
			if (otherUser === undefined) {
				this.waitList.push({socket:client, mode: data.mode});
				return;
			}
			const randomNumber: string = await this.matchService.getMatchIndex();
			roomIndex = randomNumber;
			const room = this.createRoom(roomIndex, otherUser, client, data.mode);
			otherUser.socket.emit("ready", { roomId: roomIndex, leftName: otherUser.socket.user.nickname, rightName: client.user.nickname, roomMode: room.gameMode});
			client.emit("ready", { roomId: roomIndex, leftName: otherUser.socket.user.nickname, rightName: client.user.nickname, roomMode: room.gameMode});
			this.rooms.set(roomIndex, room);
			room.start();
			await this.matchService.create(otherUser.socket.user, client.user);
		} catch (e) {
			client.emit("error", { message: "매칭에 실패하였습니다." });
		}
	}


	async joinToFriend(client: AuthSocket, data: number): Promise<void> {
		try {
			const tempRoom = Array.from(this.rooms.values()).find(
				room => room.players.find(player => player.user.id == data));
			if (tempRoom){
				client.emit("error", { message: "이미 플레이 중인 유저입니다." });
				return;
			}
			for (const list of this.inviteList) {
				if (list.to == client.user.id && list.from.user.id == data) {
					const randomNumber: string = await this.matchService.getMatchIndex();
					const friend = {socket: list.from, mode: list.mode};
					const room = this.createRoom(randomNumber, friend, client, true);
					client.emit("ready", { roomId: randomNumber, leftName: list.from.user.nickname, rightName: client.user.nickname, roomMode: room.gameMode});
					list.from.emit("ready", { roomId: randomNumber, leftName: list.from.user.nickname, rightName: client.user.nickname, roomMode: room.gameMode});
					this.rooms.set(randomNumber, room);
					room.start();
					await this.matchService.create(list.from.user, client.user);
					const inviteListIndex = this.inviteList.findIndex(inviteData => inviteData.to === client.user.id);
					this.inviteList.splice(inviteListIndex, 1);
					return;
				}
			}
			client.emit("error", { message: "친구와의 매칭에 실패하였습니다." });
		} catch {}
	}


	createRoom(roomIndex: string, other: SpecData, user2: AuthSocket, mode: boolean): Room {
		let gameMode: boolean;
		if (other.mode && mode)
			gameMode = true;
		const room: Room = new Room(
			roomIndex,
			GameState.start,
			gameMode,
			{
				ball: {x: 400, y: 300},
				leftBar: {x: 20, y: 300, power: false},
				rightBar: {x: 750, y: 300, power: false},
				score: {left: 0, right: 0},
				Move: {left: null, right: null},
			},
			[other.socket, user2],
			[],
		)
		return room;
	}


	async spectatorList(client: AuthSocket): Promise<void> {
		try {
			let roomList = [];
			for (const room of this.rooms.values()){
				roomList.push(
					{
						roomId: room.roomIndex,
						leftName: room.players[0].user.nickname,
						rightName: room.players[1].user.nickname,
					});
			}
			client.emit("roomlist", roomList);
		} catch (e) {
			client.emit("error", { message: "관전 리스트를 가져올 수 없습니다." });
		}
	}

	listenKeyEvent(client: AuthSocket, key: string){
		try{
			const room = Array.from(this.rooms.values()).find(
				room => room.players.find(
					player => player.user.id == client.user.id)
			)
			if (room.players[0] == client){
				room.gameData.Move.left = key;
			} else if (room.players[1] == client){
				room.gameData.Move.right = key;
			}
		} catch (e) {
			client.emit("error", { message: "키 입력 오류" });
		}
	}

	async spectate(client: AuthSocket, data: SpecDto){
		try{
			const room = this.rooms.get(data.id);
			if (room !== undefined) {
				room.spectators.push(client);
				client.emit("setData",
				{
					leftName: room.players[0].user.nickname,
					rightName: room.players[1].user.nickname,
					leftScore: 0,
					rightScore: 0,
				});
			} else {
				const matchEntity = await this.matchService.getOne(data.id);
				client.emit("finish",
				{
					leftName: matchEntity.winner.nickname,
					rightName: matchEntity.loser.nickname,
					leftScore: matchEntity.winnerScore,
					rightScore: matchEntity.loserScore
				});
				client.emit("end", "left");
			}
		} catch (e) {
			client.emit("error", { message: "관전 정보를 가져올 수 없습니다." });
		}
	}

	async achievement(client: AuthSocket){
		try{
			const wonCount = await this.userService.wonCount(client.user.id);
			const lostCount = await this.userService.lostCount(client.user.id);
			if (wonCount == 1){
				await this.userService.updateAchievement(client.user.id, "first win");
				await this.userService.updateLadder(client.user.id, UserLadder.Gold);
			} else if (wonCount == 3) {
				await this.userService.updateAchievement(client.user.id, "third win");
				if (lostCount == 0){
					await this.userService.updateAchievement(client.user.id, "perfect win");
				}
			} else if (wonCount == 5){
				await this.userService.updateAchievement(client.user.id, "fifth win");
				await this.userService.updateLadder(client.user.id, UserLadder.Master);
			}
		} catch (e) {
			client.emit("error", { message: "업적 시스템 오류" });
		}
	}

	async dropUser(client: AuthSocket){
		if (this.waitList.find(user => user.socket.user.id === client.user.id)){
			this.waitList.pop();
		}
		for (const list of this.inviteList) {
			if (list.from.user.id == client.user.id){
				const inviteListIndex = this.inviteList.findIndex(inviteData => inviteData.from.user.id == client.user.id);
				this.inviteList.splice(inviteListIndex, 1);
			}
		}
		const room = Array.from(this.rooms.values()).find(
			room => room.players.find(player => player.user.id == client.user.id));
		if (!room)
			return;
		if (room.players[0].user.id == client.user.id){
			room.players[1].emit("end", "right");
			if (room.spectators)
			{
				for (const spectator of room.spectators){
					spectator.emit("end", "right");
				}
			}
			await this.matchService.update(
				room.roomIndex,
				{
					winner: room.players[1].user,
					loser: room.players[0].user,
					winnerScore: room.gameData.score.right,
					loserScore: room.gameData.score.left,
				});
		} else if(room.players[1].user.id == client.user.id){
			room.players[0].emit("end", "left");
			if (room.spectators)
			{
				for (const spectator of room.spectators){
					spectator.emit("end", "left");
				}
			}
			await this.matchService.update(
				room.roomIndex,
				{
					winner: room.players[0].user,
					loser: room.players[1].user,
					winnerScore: room.gameData.score.left,
					loserScore: room.gameData.score.right,
				});
		}
		this.rooms.delete(room.roomIndex);
	}

	@Interval(1000 / 60)
	loop(): void {
		for (const room of this.rooms.values())
		{
			if (room.gameState == GameState.start) {
				room.gameUpdate(room.gameData.Move.left, room.gameData.Move.right);
				room.players[0].emit("update", room.gameData);
				room.players[1].emit("update", room.gameData);
				if (room.spectators)
				{
					for (const spectator of room.spectators){
						spectator.emit("update", room.gameData);
					}
				}
				if (room.gameData.score.left == 6 || room.gameData.score.right == 6) {
					room.gameState = GameState.end;
					if (room.gameData.score.left == 6){
						room.players[0].emit("end", "left");
						room.players[1].emit("end", "left");
					} else if (room.gameData.score.right == 6) {
						room.players[0].emit("end", "right");
						room.players[1].emit("end", "right");
					}
					if (room.spectators)
					{
						for (const spectator of room.spectators){
							if (room.gameData.score.left == 6){
								spectator.emit("end", "left");
							} else if (room.gameData.score.right == 6) {
								spectator.emit("end", "right");
							}
						}
					}
					const winner = (room.gameData.score.left == 6) ? room.players[0] : room.players[1];
					const loser = (room.gameData.score.left == 6) ? room.players[1] : room.players[0];
					const winnerScore = (room.gameData.score.left == 6) ? room.gameData.score.left : room.gameData.score.right;
					const loserScore = (room.gameData.score.left == 6) ? room.gameData.score.right : room.gameData.score.left;
					this.matchService.update(
						room.roomIndex,
						{
							winner: winner.user,
							loser: loser.user,
							winnerScore: winnerScore,
							loserScore: loserScore,
						});
					this.rooms.delete(room.roomIndex);
				}
			}
		}
	}
}
