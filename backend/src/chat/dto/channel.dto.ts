import { User } from "src/user/entity/user.entity";
import { IsBoolean, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChannelDto {
	@IsString()
  @MinLength(2)
  @MaxLength(12)
	name: string;

	@IsString()
	@MaxLength(16)
	@Matches(/^[A-Za-z\d!@#$%^&*()]{8,16}$/)
	password: string;

	@IsBoolean()
	isPrivate: boolean;

	users: [ (User) ];
}
