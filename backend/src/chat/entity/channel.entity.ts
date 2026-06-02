import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	ManyToMany,
	JoinTable,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/user/entity/user.entity';
import { Message } from './message.entity';

@Entity()
export class Channel {
	@PrimaryGeneratedColumn()
  id: number;

	@Column({ length: 12 })
	name: string;

	@Column("text", {default: ""})
	password: string;

	@CreateDateColumn()
	createAt: Date;

	@UpdateDateColumn()
	updateAt: Date;

	@ManyToMany(() => User, {onDelete:'CASCADE'})
	@JoinTable()
	users: User[];

	@Column({nullable: true})
	owner: number;

	@Column({ type: 'int', array: true, default: {} })
	admins: number[];

	@Column('boolean', {default: false})
	isPrivate: boolean;

	@Column('boolean', {default: false})
	isDM: boolean;

	@ManyToMany(() => Message, {onDelete:'CASCADE'})
  @JoinTable()
  messages: Message[];

	@Column({ type: 'int', array: true, default: {} })
	bans: number[];

	@Column({ type: 'int', array: true, default: {} })
	mutes: number[];
}
