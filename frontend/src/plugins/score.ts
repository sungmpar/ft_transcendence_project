export class Score {
	score: number;

	constructor(score = 0){
	    this.score = score;
	}

    update(score: number){
        this.score++;
    }
}
