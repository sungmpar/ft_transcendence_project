import { IsBoolean, IsNumber, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class JoinChannelDto {
	@IsNumber()
	readonly id: number;

	@IsString()
	@MaxLength(16)
	@Matches(/^[A-Za-z\d!@#$%^&*()]{8,16}$/)
	password: string;

	@IsBoolean()
	isPrivate: boolean;
}
