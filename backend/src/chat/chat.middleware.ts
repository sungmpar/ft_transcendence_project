import { Socket } from "socket.io";
import { User } from "src/user/entity/user.entity";
import { JwtService } from "@nestjs/jwt";
import { UserService } from "src/user/user.service";
import { JwtPayload } from "src/auth/jwt.strategy";

export interface AuthSocket extends Socket {
	user: User;
}

export type SocketMiddleware = (socket: Socket, next: (err?: Error) => void) => void

export const WSAuthMiddleware = (jwtService: JwtService, userService: UserService): SocketMiddleware => {
	return async (socket: AuthSocket, next) => {
		try {
			const token = socket.handshake.auth.token;
			const payload: JwtPayload = await jwtService.verify(token, {secret: process.env.SECRET});
			const user = await userService.getOneByName(payload.username);
			// console.log(console.log("connecting . . . . . .", user))
			if (user === undefined)
				throw new Error("User not found");
			socket.user = user;
			next();
		}
		catch (e) {
			next({
				name: 'Unauthorized',
				message: 'Unauthorized',
			});
		}
	}
}
