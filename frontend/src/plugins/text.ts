import store from "@/store";

export class EndText {
	public draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, data: string){
		ctx.font = "100px Gothic";
		ctx.textAlign = "center";
		ctx.fillStyle = '#FFFFFF';
		if (store.getters.gameData.score.left === 6 || data == "left") {
			ctx.fillText("WIN", canvasWidth, canvasHeight);
			ctx.fillText("LOSE",  3 * canvasWidth, canvasHeight);
		} else if (store.getters.gameData.score.right === 6 || data == "right") {
			ctx.fillText("LOSE", canvasWidth, canvasHeight);
			ctx.fillText("WIN",  3 * canvasWidth, canvasHeight);
		}
	}
}

export class StartText{
	public static draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, text: string, ready: boolean){
		ctx.font = "70px Gothic";
		ctx.textAlign = "center";
		ctx.fillStyle = '#FFFFFF';
		if (store.getters.mode)
		ctx.fillText("Space : Power Up", canvasWidth, 1 * canvasHeight);
		ctx.fillText("⬆ : Up", canvasWidth, 2 * canvasHeight);
		ctx.fillText("⬇ : Down", canvasWidth, 3 * canvasHeight);

		ctx.fillText("◁",  (3 * canvasWidth) / 4 , 4 * canvasHeight);
		ctx.fillText(text, canvasWidth, 4 * canvasHeight);
		ctx.fillText("▷", (5 * canvasWidth) / 4, 4 * canvasHeight);
		if (ready) {
			ctx.fillStyle = 'Yellow';
		}
		const inviteFriendName = store.getters.inviteFriendName;
		if (inviteFriendName)
			ctx.fillText(inviteFriendName, canvasWidth , 5 * canvasHeight);
		else
			ctx.fillText("Ready",  canvasWidth , 5 * canvasHeight);
	}
}

export class SpectatorEndText {
	public draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, data: string){
		ctx.font = "100px Gothic";
		ctx.textAlign = "center";
		ctx.fillStyle = '#FFFFFF';
		console.log("asdfasdf");
		if (store.getters.gameData.score.left === 6 || data == "left") {
			ctx.fillText("WIN", canvasWidth, canvasHeight);
			ctx.fillText("LOSE",  3 * canvasWidth, canvasHeight);
		} else if (store.getters.gameData.score.right === 6 || data == "right") {
			ctx.fillText("LOSE", canvasWidth, canvasHeight);
			ctx.fillText("WIN",  3 * canvasWidth, canvasHeight);
		}
	}
}

export class SpectatorStartText{
	public static draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number){
		ctx.font = "70px Gothic";
		ctx.textAlign = "center";
		ctx.fillStyle = '#FFFFFF';
		ctx.fillText(store.getters.room.leftName,  canvasWidth, canvasHeight);
		ctx.fillText("VS", 2 * canvasWidth, canvasHeight);
		ctx.fillText(store.getters.room.rightName, 3 * canvasWidth, canvasHeight);

	}
}
