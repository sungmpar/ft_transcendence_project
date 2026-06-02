import { throws } from "assert";
import { gameConstants } from "../interface/game.state";

export class Bar {
	x: number;
	y: number;
	status: boolean;
	stack: number;

	playerHeight = gameConstants.playerHeight;
	playerWidth = gameConstants.playerWidth

	playerMoveSpeed = gameConstants.playerMoveSpeed;

	canvasWidth= gameConstants.canvasWidth;
	canvasHeight = gameConstants.canvasHeight;

	isActive: boolean;
	isVisible: boolean;

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
		this.status = false;
		this.stack = 0;
	}

	public update(key: string, mode: boolean){
		if (this.status && this.stack == 0){
			this.playerHeight = 200;
			this.status = false;
		}
		if (key == "down"){
			this.y += this.playerMoveSpeed;
			if(this.y + (this.playerHeight + this.playerMoveSpeed) > this.canvasHeight){
				this.y = this.canvasHeight - this.playerHeight;
			}
		} else if (key == "up"){
			this.y -= this.playerMoveSpeed;
			if (this.y < 0) {
				this.y = 0;
			}
		} else if (key == "space" && this.stack == 5 && mode == true){
			this.status = true;
			this.playerHeight = 400;
			if (this.y > this.canvasHeight - this.playerHeight){
				this.y = this.playerHeight;
			}
		}
		return ({x: this.x, y: this.y, power: this.status});
	}
}

