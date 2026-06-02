import { Column, Entity, PrimaryColumn, ManyToMany, PrimaryGeneratedColumn, Generated, OneToMany, JoinTable} from 'typeorm';
import { Channel } from 'src/chat/entity/channel.entity';
import { UserStatus } from '../interface/user.status';
import { Match } from './match.entity';
import { UserLadder } from '../interface/user.ladder';


@Entity('User')
export class User {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ unique: true })
	name: string;

	@Column({ length: 60 })
	email: string;

	@Column({ length: 80, default: process.env.DEFAULT_IMG })
	profileUrl: string;

	@Column({ unique: true, length: 10, nullable: true })
	nickname: string;

	@Column("boolean", { default: false })
	need2fa: boolean;

	@Column("boolean", { default: false })
	is2fa: boolean;

	@Column("boolean", { default: false })
	isBanned: boolean;

	@Column("text", { default: UserStatus.offline })
	status: UserStatus;

	@ManyToMany(() => Channel, channel => channel.users)
	channels: Channel[];

	@ManyToMany(() => Match, match => match.players)
	matches: Match[];

	@Column({ type: 'int', array: true, default: {} })
	friends: number[];

  @Column({ type: 'int', array: true, default: {} })
	blocks: number[];

	@Column({ type: 'text', array: true, default: {} })
	achievement: string[];

	@OneToMany(() => Match, (Match) => Match.winner)
  won: Match[];

  @OneToMany(() => Match, (Match) => Match.loser)
  lost: Match[];

	@Column({ default: UserLadder.Newbie })
  ladder: UserLadder;
}

