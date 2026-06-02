import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Match } from './entity/match.entity';
import { User } from './entity/user.entity';

@Injectable()
export class MatchService {
	constructor(
		@InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
  ){}

	async create(user1: User, user2: User) {
		const newMatch = this.matchRepository.create({
			players: [user1, user2],
		});
		return await this.matchRepository.save(newMatch);
	}

	async getOne(idStr: string) {
		const id = parseInt(idStr);
		const match = await this.matchRepository.findOne({
			where: { id: id },
		});
		return match;
	}

	async getAll(user: User) {
		const matchs = await this.matchRepository.find({
			where: { players: In([ user ]) },
			relations: ['players'],
		});
		const matchlist = matchs.filter(match => match.players.find(player => player.id == user.id))
		return matchlist;
	}

	async update(id: string, matchResult: {
		winner: User,
		loser: User,
		winnerScore: number,
		loserScore: number,
	}) {
		if (await this.matchRepository.update(id, matchResult))
			return await this.getOne(id);
		throw new NotFoundException();
	}

	async delete(id: string) {
		if (await this.matchRepository.delete(id))
			return true;
		throw new NotFoundException();
	}

	async getMatchIndex() {
		const count = await this.matchRepository.count();
		return ((count + 1).toString());
	}
}

