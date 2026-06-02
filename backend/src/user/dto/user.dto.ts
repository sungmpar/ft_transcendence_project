import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UserDto {

	@IsString()
  @MinLength(2)
  @MaxLength(8)
  readonly name: string;

  @IsEmail()
  @MaxLength(30)
	email: string;

	@IsString()
	readonly profileUrl: string;
}
