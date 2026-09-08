import { Constants } from "@/models/GameState";
import store from "@/store";
import { Keyboard } from "./keyboard";

export class Bar {
	x: number;
	y: number;

	playerHeight = Constants.playerHeight;
	playerWidth = Constants.playerWidth;

	isMovingUp = false;
	isMovingDown = false;

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	public draw(ctx: CanvasRenderingContext2D, x: number, y: number, power: boolean) {
		this.x = x;
		this.y = y;
		if (power && store.getters.mode){
			this.playerHeight = 400;
		} else {
			this.playerHeight = 200;
		}
		ctx.beginPath();
		ctx.fillStyle = "#B2FF66";
		ctx.fillRect(this.x, this.y, this.playerWidth, this.playerHeight);
		ctx.closePath();
	}

	public processKeyboardEvent(keyboard: Keyboard){
		const up = keyboard.isKeyPressed('Up') || keyboard.isKeyPressed('ArrowUp');
		const down = keyboard.isKeyPressed('Down') || keyboard.isKeyPressed('ArrowDown');
		if (up && !down) {
			console.log('up');
			store.getters.gameSocket.emit("keyboardEvent", "up");
		} else if (down && !up){
			store.getters.gameSocket.emit("keyboardEvent", "down");
		} else if (keyboard.isKeyPressed('Space')){
			store.getters.gameSocket.emit("keyboardEvent", "space");
		} else {
			store.getters.gameSocket.emit("keyboardEvent", "none");
		}
	}
}
