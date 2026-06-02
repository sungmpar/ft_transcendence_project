export interface GameState{
		ball: {x: number, y:number},
		leftBar: {x: number, y:number},
		righBar: {x: number, y:number},
		score: {left: number, right: number},
}

export interface Enemy{
  id: number,
  name: string,
  nickname: string,
  profileUrl: string,
}

export interface Room{
  id: string,
  state: number,
  nickname: string,
  profileUrl: string,
}
