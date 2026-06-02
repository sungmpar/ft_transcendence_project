import { Ball } from "@/plugins/ball";
import { Score } from "@/plugins/score";
import { Constants } from "@/models/GameState";
import { Bar } from "@/plugins/bar";
import { Background } from "@/plugins/background";
import { Keyboard } from "@/plugins/keyboard";
import { Line } from "@/plugins/line";
import store from "@/store";
import {GameState} from "@/interfaces/Game";
import { EndText } from "./text";
import { SpectatorEndText } from "./text";


/* 추상 클래스는 부모 클래스 새로운 일반 클래스를 위한 부모 클래스로 사용*/
/* game에 쓰이는 모든 요소를 모아둔 service */
export class GameplayService {
	/* canvas 요소들을 저장 */
	private static ctx: CanvasRenderingContext2D;
	private static canvasWidth: number;
	private static canvasHeight: number;
	private static background : Background;
	private static line : Line;
	private static renderRequestId: number;

	private static processKeyDownEventThunk: (e: KeyboardEvent) => void;
  private static processKeyUpEventThunk: (e: KeyboardEvent) => void;

	private static nowTime: number;
	private static deltaTime: number;
	private static thenTime = performance.now();

	private static keyboard: Keyboard;
	private static rightPlayer: Bar;
	private static leftPlayer: Bar;
	private static player: Bar;
	private static ball: Ball;

	private static endText: EndText;
	private static spectatorEndText: SpectatorEndText;

	public static processFrame(){
		this.nowTime = performance.now();
		this.deltaTime = this.nowTime - this.thenTime;
		this.thenTime = this.nowTime;

		const data = store.getters.gameData;
		// console.log(data.leftPlayer.y);

		this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
		this.background.draw(this.ctx, this.canvasWidth * 2, this.canvasHeight*2);
		this.line.draw(this.ctx, this.canvasWidth, this.canvasHeight);
		this.ball.draw(this.ctx, data.ball.x, data.ball.y);
		this.leftPlayer.draw(this.ctx, data.leftPlayer.x, data.leftPlayer.y, data.leftPlayer.power);
		this.rightPlayer.draw(this.ctx, data.rightPlayer.x, data.rightPlayer.y, data.rightPlayer.power);

		this.renderRequestId = window.requestAnimationFrame(this.processFrame.bind(this));
	}

	private static processKeyboardDownInput(e: KeyboardEvent): void {
    if (e.defaultPrevented) {
      return;
    }
    this.keyboard.set(e.code, {
      pressed: true,
    });
    this.player.processKeyboardEvent(this.keyboard);
  }

  private static processKeyboardUpInput(e: KeyboardEvent): void {
    if (e.defaultPrevented) {
      return;
    }
    this.keyboard.set(e.code, {
      pressed: false,
    });
    this.player.processKeyboardEvent(this.keyboard);
  }


	public static stop(data: string){
		this.endText.draw(this.ctx, this.canvasWidth/4, this.canvasHeight/2, data);
		window.cancelAnimationFrame(this.renderRequestId);
		window.removeEventListener('keydown', this.processKeyDownEventThunk);
		window.removeEventListener('keyup', this.processKeyUpEventThunk);
	}

	public static stopSpectate(data: string){
		this.spectatorEndText.draw(this.ctx, this.canvasWidth/4, this.canvasHeight/2, data);
		window.cancelAnimationFrame(this.renderRequestId);
		window.removeEventListener('keydown', this.processKeyDownEventThunk);
		window.removeEventListener('keyup', this.processKeyUpEventThunk);
	}


	public static start(ctx: CanvasRenderingContext2D, backgroundImage: string){
		this.ctx = ctx;
		this.canvasHeight = ctx.canvas.height;
		this.canvasWidth = ctx.canvas.width;
		this.background = new Background(this.ctx, backgroundImage);
		this.rightPlayer = new Bar(this.canvasWidth - Constants.playerWidth - 30, this.canvasHeight / 2 - Constants.playerHeight / 2);
		this.leftPlayer = new Bar(30, this.canvasHeight / 2 - Constants.playerHeight / 2);
		this.player = new Bar(0,0);
		this.line = new Line;
		this.ball = new Ball(this.canvasWidth/2, this.canvasHeight/2);
		this.endText = new EndText();
		this.spectatorEndText = new SpectatorEndText();
		this.keyboard = new Keyboard();
		this.processKeyDownEventThunk = this.processKeyboardDownInput.bind(this);
		window.addEventListener('keydown', this.processKeyDownEventThunk);
		this.processKeyUpEventThunk = this.processKeyboardUpInput.bind(this);
		window.addEventListener('keyup', this.processKeyUpEventThunk);
		this.renderRequestId = window.requestAnimationFrame(this.processFrame.bind(this));
	}
}
