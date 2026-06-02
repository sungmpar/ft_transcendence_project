import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { User } from './entity/user.entity';

@Injectable()
export class UserGuard implements CanActivate {
	constructor() {}

	async canActivate(context: ExecutionContext): Promise<any> {
		const request = context.switchToHttp().getRequest();
		const user: User = request.user;

		if (user.isBanned === true) {
			throw new ForbiddenException('you are banned. no longer have access');
		}
		if (user.need2fa === true && user.is2fa === false) {
			throw new ForbiddenException('2FA authentication should be fulfilled');
		}
	return true;
	}
}
