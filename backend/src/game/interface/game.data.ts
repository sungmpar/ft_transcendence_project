export interface GameData {
	ball: {x:number, y:number},
	leftBar: {x:number, y:number, power: boolean},
	rightBar: {x:number, y:number, power: boolean},
	score: {left:number, right:number},
	Move: {left: string; right: string;},
}
