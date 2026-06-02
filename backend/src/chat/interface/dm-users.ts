import { UserStatus } from "src/user/interface/user.status";

export interface dmUsers {
	id: number;
	name: string;
	status: UserStatus;
	messages: [];
}
