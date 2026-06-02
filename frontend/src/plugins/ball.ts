import { Constants } from "@/models/GameState";

export class Ball {
	public x: number;
	public y: number;

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	public draw(ctx: CanvasRenderingContext2D, x: number, y: number) {
		this.x = x;
		this.y = y;
		ctx.beginPath();
		ctx.arc(this.x, this.y, Constants.ballRadius, 0, Math.PI*2);
		ctx.fillStyle = "#FFFFFF";
		ctx.fill();
		ctx.closePath();
	}
}
