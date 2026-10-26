import { BadRequestException, NotFoundException } from '@nestjs/common';
import { User } from './entity/user.entity';

/** Validate the raw HTTP value before TypeORM can interpret an omitted filter. */
export function publicUserId(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,9}$/.test(value))
    throw new BadRequestException('A positive integer user id is required');
  const id = Number(value);
  // User.id is a PostgreSQL int4. Larger numeric strings must be a 400, not a
  // database cast error or a rounded JavaScript number.
  if (!Number.isSafeInteger(id) || id > 2147483647)
    throw new BadRequestException('A positive integer user id is required');
  return id;
}

export type PublicUserProfile = Pick<User, 'id' | 'nickname' | 'profileUrl' | 'status'>;

/** Explicit allowlist: adding a private entity column must not expose it here. */
export function publicUserProfile(user: User | null | undefined): PublicUserProfile {
  if (!user) throw new NotFoundException('User not found');
  return { id: user.id, nickname: user.nickname, profileUrl: user.profileUrl, status: user.status };
}
