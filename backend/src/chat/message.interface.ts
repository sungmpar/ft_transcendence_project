import { User } from "src/user/entity/user.entity";

export interface MessageI {
  id?: number;
  user?: User;
	message?: string;
}
