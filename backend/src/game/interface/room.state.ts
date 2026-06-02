import { AuthSocket } from "../game.middleware";
import { Ball } from "../pong-model/ball";
import { Bar } from "../pong-model/player";
import { GameData } from "./game.data";
import { gameConstants } from "./game.state";

export enum GameState {
  ready,
	start,
	end,
}

export class Room {
  roomIndex: string;
	gameState: GameState;
	gameMode: boolean;
	gameData: GameData;
  players: Array<AuthSocket>;
  spectators: Array<AuthSocket>;

	rightPlayer: Bar;
	leftPlayer: Bar;
	ball: Ball;

	constructor(roomIndex: string, gameState: GameState, gameMode: boolean, gameData: GameData, players: Array<AuthSocket>, spectators?: Array<AuthSocket>) {
		this.roomIndex = roomIndex;
		this.gameState = gameState;
		this.gameMode = gameMode;
		this.gameData = gameData;
		this.players = players;
		this.spectators = spectators;
	}

	async gameUpdate(leftKey: string, rightKey: string){
		this.gameData.leftBar = this.leftPlayer.update(leftKey, this.gameMode);
		this.gameData.rightBar = this.rightPlayer.update(rightKey, this.gameMode);
		this.gameData.ball = this.ball.update();
		this.gameData.score.left += this.ball.rightPlayerCollision(this.rightPlayer);
		this.gameData.score.right += this.ball.leftPlayerCollision(this.leftPlayer);
		return (this.gameData);
	}

	async start(){
		this.leftPlayer = new Bar(20, gameConstants.canvasHeight / 2 - gameConstants.playerHeight / 2);
		this.rightPlayer = new Bar(gameConstants.canvasWidth - gameConstants.playerWidth - 20, gameConstants.canvasHeight / 2 - gameConstants.playerHeight / 2);
		this.ball = new Ball(gameConstants.canvasWidth / 2, gameConstants.canvasHeight / 2);
	}

	async endGame() {
		this.gameState = GameState.end;
	}

	async removeSpectator(spectator: AuthSocket) {
		const index = this.spectators.indexOf(spectator);
		this.spectators.splice(index, 1);
	}

	async changeGameState(gameState: GameState) {
		this.gameState = gameState;
	}

	async getRoom(): Promise<Room> {
		return this;
	}
}
