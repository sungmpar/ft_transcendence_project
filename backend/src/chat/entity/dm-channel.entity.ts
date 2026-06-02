import {
	Entity,
	PrimaryGeneratedColumn,
	ManyToMany,
	JoinTable,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/user/entity/user.entity';
import { Message } from './message.entity';

@Entity()
export class DMChannel {
	@PrimaryGeneratedColumn()
  id: number;

	@CreateDateColumn()
	createAt: Date;

	@UpdateDateColumn()
	updateAt: Date;

	@ManyToMany(() => User, {onDelete:'CASCADE'})
	@JoinTable()
	users: User[];

	@ManyToMany(() => Message)
  @JoinTable()
  messages: Message[];
}
