import { User } from "src/user/entity/user.entity";
import { Message } from "./entity/message.entity";

export interface ChannelI {
  id?: number;
  name?: string;
	password?: string;
  users?: User[];
	createAt?: Date;
	updateAt?: Date;
	owner?: number;
	admins?: number[];
	isPrivate?: boolean;
	isDm?: boolean;
	messages?: Message[];
	bans?: number[];
	mutes?: number[];
}
