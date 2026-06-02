import { gameConstants } from "../interface/game.state";
import { Bar } from "./player";

export class Ball {
	x: number;
	y: number;

	dX = gameConstants.ballSpeed;
	dY = -gameConstants.ballSpeed;

	ballRadius = gameConstants.ballRadius

	canvasWidth= gameConstants.canvasWidth;
	canvasHeight = gameConstants.canvasHeight;

	leftPlayerHeight = gameConstants.playerHeight;
	rightPlayerHeight = gameConstants.playerHeight;
	playerWidth = gameConstants.playerWidth;

	isPass: boolean;
	isActive: boolean;
	isVisible: boolean;
	isSticky: boolean;


	constructor(x = 0, y = 0) {
		this.x = x;
		this.y = y;

		this.isPass = false;
		this.isActive = true;
		this.isVisible = true;
		this.isSticky = false;
	}

	public rightPlayerCollision(player: Bar){
		if (player.status){
			this.rightPlayerHeight = 400;
		} else if (!player.status){
			this.rightPlayerHeight = 200;
		}
		if (this.x > this.canvasWidth / 2){
			if (this.x >= player.x && (this.y < player.y || this.y > player.y + this.rightPlayerHeight)){
				this.isPass = true;
			} else {
				this.isPass = false;
			}
			if (this.x + this.ballRadius >= player.x &&
				this.y - this.ballRadius < player.y + this.rightPlayerHeight &&
				this.y + this.ballRadius > player.y){
				if (this.isSticky === false){
					if (!this.isPass){
						const percentage = (this.y - player.y) / this.rightPlayerHeight;
						this.dY = (percentage * gameConstants.ballSpeed * 3) - (gameConstants.ballSpeed)
						this.dX = -this.dX;
					} else {
						this.dY = -this.dY;
					}
					this.isSticky = true;
					if (player.status == true && player.stack > 0){
						player.stack -= 1;
					} else if (player.status == false && player.stack < 5){
						player.stack += 1;
					}
				}
			} else {
				this.isSticky = false;
			}
			if(this.x + this.dX > this.canvasWidth - this.ballRadius){
				return (1);
			} else {
				return (0);
			}
		}
		return (0);
	}

	public leftPlayerCollision(player: Bar){
		if (player.status){
			this.leftPlayerHeight = 400;
		} else if (!player.status){
			this.leftPlayerHeight = 200;
		}
		if (this.x < this.canvasWidth / 2){
			if (this.x <= player.x + this.playerWidth && (this.y < player.y || this.y > player.y + this.leftPlayerHeight)){
				this.isPass = true;
			} else {
				this.isPass = false;
			}
			if (this.x - this.ballRadius <= player.x + this.playerWidth &&
				this.y - this.ballRadius <= player.y + this.leftPlayerHeight &&
				this.y + this.ballRadius >= player.y){
				if (this.isSticky === false){
					if (!this.isPass){
						const percentage = (this.y - player.y) / this.leftPlayerHeight;
						this.dY = (percentage * gameConstants.ballSpeed * 3) - (gameConstants.ballSpeed)
						this.dX = -this.dX;
					} else {
						this.dY = -this.dY;
					}
					this.isSticky = true;
					if (player.status == true && player.stack > 0){
						player.stack -= 1;
					} else if (player.status == false && player.stack < 5){
						player.stack += 1;
					}
				}
			} else {
				this.isSticky = false;
			}
			if (this.x + this.dX < this.ballRadius){
				return (1);
			} else {
				return (0);
			}
		}
		return (0);
	}

	public update(){
		if (this.x + this.dX > this.canvasWidth - this.ballRadius ||
				this.x + this.dX < this.ballRadius){
					this.dX = -this.dX;
					this.x = this.canvasWidth / 2;
					this.y = this.canvasHeight / 2;

		}
		if (this.y + this.dY > this.canvasHeight - this.ballRadius ||
			this.y + this.dY < this.ballRadius){
				this.dY = -this.dY;
		}
		this.x += this.dX;
		this.y += this.dY;
		return ({x: this.x, y: this.y})
	}
}

