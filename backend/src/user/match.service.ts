import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Match } from './entity/match.entity';
import { User } from './entity/user.entity';
import { UserLadder } from './interface/user.ladder';

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
		// Published-but-unfinished and storage-failed rows are not match history.
		const matchlist = matchs.filter(match => match.winner && match.loser &&
			match.players.find(player => player.id == user.id))
		return matchlist;
	}

	async update(id: string, matchResult: {
		winner: User,
		loser: User,
		winnerScore: number,
		loserScore: number,
	}) {
		return this.matchRepository.manager.transaction(async (manager) => {
			const matches = manager.getRepository(Match);
			const users = manager.getRepository(User);
			// A stable lock order serializes concurrent results for the same users,
			// so their win counts and achievements include earlier committed matches.
			const ids = [matchResult.winner.id, matchResult.loser.id].sort((a, b) => a - b);
			const lockedUsers = await users.createQueryBuilder('player')
				.where('player.id IN (:...ids)', { ids }).orderBy('player.id', 'ASC')
				.setLock('pessimistic_write').getMany();
			const existing = await matches.findOne({ where: { id: Number(id) }, relations: ['players'] });
			if (!existing) throw new NotFoundException();
			if (lockedUsers.length !== 2 || ids[0] === ids[1] ||
				!ids.every((playerId) => existing.players.some((player) => player.id === playerId))) {
				throw new ConflictException('Match participants do not match the stored game');
			}
			const updated = await matches.createQueryBuilder().update(Match).set(matchResult)
				.where('id = :id', { id: Number(id) })
				.andWhere('"winnerId" IS NULL AND "loserId" IS NULL').execute();
			if (updated.affected !== 1) {
				const stored = await matches.findOne({ where: { id: Number(id) } });
				if (!stored) throw new NotFoundException();
				if (stored.winner?.id === matchResult.winner.id && stored.loser?.id === matchResult.loser.id &&
					stored.winnerScore === matchResult.winnerScore && stored.loserScore === matchResult.loserScore) return stored;
				throw new ConflictException('The match already has a different final result');
			}
			const winner = lockedUsers.find((player) => player.id === matchResult.winner.id);
			const wonCount = await matches.count({ where: { winner: { id: winner.id } } });
			const lostCount = await matches.count({ where: { loser: { id: winner.id } } });
			const achievements = new Set(winner.achievement);
			if (wonCount >= 1) achievements.add('first win');
			if (wonCount >= 3) {
				achievements.add('third win');
				if (lostCount === 0) achievements.add('perfect win');
			}
			if (wonCount >= 5) achievements.add('fifth win');
			await users.update(winner.id, { achievement: Array.from(achievements),
				ladder: wonCount >= 5 || winner.ladder === UserLadder.Master ? UserLadder.Master : UserLadder.Gold });
			return matches.findOne({ where: { id: Number(id) } });
		});
	}

	async delete(id: string) {
		const result = await this.matchRepository.delete(id);
		if (result.affected === 1)
			return true;
		throw new NotFoundException();
	}

}
