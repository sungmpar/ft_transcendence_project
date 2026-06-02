import store from "@/store";
import { toHandlers } from "vue";
import { GameImageService } from "../models/GameImageService";

export class Background{
	background: string;
	pattern: CanvasPattern;

	constructor(ctx: CanvasRenderingContext2D, backgroundImage: string) {
		this.background = backgroundImage;
		if (this.background === "black") {
			this.pattern = ctx.createPattern(GameImageService.fetchImage("winter"), "repeat")!;
		} else {
			this.pattern = ctx.createPattern(GameImageService.fetchImage(backgroundImage), "repeat")!;
		}
	}

	public draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) {
		if (this.background !== "black") {
			ctx.fillStyle = this.pattern;
		} else {
			ctx.fillStyle = "#000000";
		}
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);
	}
}
