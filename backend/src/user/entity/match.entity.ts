import { IsNumber } from 'class-validator';
import { User } from 'src/user/entity/user.entity';
import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('Match')
export class Match {
  @PrimaryGeneratedColumn()
  @ApiProperty({ type: Number, description: 'unique id' })
  id: number;

	@ManyToMany(() => User, {onDelete:'CASCADE'})
	@JoinTable()
  players: User[];

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE', nullable: true })
  @JoinColumn()
  winner: User;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE', nullable: true })
  @JoinColumn()
  loser: User;

  @Column({ nullable: true })
  winnerScore: number;

  @Column({ nullable: true })
  loserScore: number;
}
