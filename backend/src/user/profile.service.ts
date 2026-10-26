import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { del, put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { basename, resolve, sep } from 'path';
import { createReadStream, existsSync } from 'fs';
import { Response } from 'express';
import { normalizeAvatar } from './avatar-normalization';
import { mkdir, writeFile } from 'fs/promises';

const DEFAULT_AVATAR = './profiles/default.jpeg';
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/png': 'png',
};

@Injectable()
export class ProfileService {
	constructor(
		private userService: UserService,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
	){
		if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN)
			throw new Error('BLOB_READ_WRITE_TOKEN is required on Vercel');
	}

	async saveProfileImage(user: User, file: { buffer?: Buffer; mimetype: string }): Promise<void> {
    const buffer = await normalizeAvatar(file);
    const filename = `${user.id}-${randomUUID()}.png`;
    if (process.env.VERCEL) {
      const blob = await put(`profiles/${user.id}/${filename}`, buffer, {
        access: 'public', contentType: 'image/png', addRandomSuffix: false,
      });
      try {
        await this.updateProfileUrl(user.name, blob.url);
      } catch (error) {
        // Roll back only the object just created by this request, never another avatar.
        await del(blob.url).catch(() => undefined);
        throw error;
      }
    } else {
      const root = resolve(process.cwd(), 'profiles');
      await mkdir(root, { recursive: true });
      await writeFile(resolve(root, filename), buffer, { flag: 'wx' });
      try { await this.updateProfileUrl(user.name, `./profiles/${filename}`); }
      catch (error) { await this.deleteImage(filename); throw error; }
    }
  }

	/** Image APIs keep their old routes; hosted avatars redirect to the Blob CDN. */
	sendProfileImage(user: User, res: Response): void {
		// The API URL is stable, while each uploaded object URL is immutable.
		res.set('Cache-Control', 'no-store');
		const stored = user.profileUrl || DEFAULT_AVATAR;
		if (this.isBlobUrl(stored)) {
			res.redirect(302, stored);
			return;
		}
		if (process.env.VERCEL) {
			res.redirect(302, '/default.jpeg');
			return;
		}
		const root = resolve(process.cwd(), 'profiles');
		const path = resolve(root, basename(stored));
		if (!path.startsWith(root + sep) || !existsSync(path)) {
			res.status(404).send('not found');
			return;
		}
		res.set('Content-Type', stored.endsWith('.png') ? 'image/png' : 'image/jpeg');
		createReadStream(path).pipe(res);
	}

	private isBlobUrl(value: string): boolean {
		try {
			const url = new URL(value);
			return url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com');
		} catch {
			return false;
		}
	}

	private ownedReplacement(previous: string, next: string, userId: number): boolean {
		if (!this.isBlobUrl(previous) || !this.isBlobUrl(next)) return false;
		const oldUrl = new URL(previous), nextUrl = new URL(next);
		const prefix = `/profiles/${userId}/`;
		return oldUrl.origin === nextUrl.origin && oldUrl.pathname.startsWith(prefix) && nextUrl.pathname.startsWith(prefix);
	}

	async updateProfileUrl(name: string, path: string) {
		// Serialize replacements across Functions so every successful update
		// observes the actual preceding object, rather than an old request snapshot.
		const changed = await this.userRepository.manager.transaction(async (manager) => {
			const repository = manager.getRepository(User);
			const user = await repository.findOne({ where: { name }, lock: { mode: 'pessimistic_write' } });
			if (!user) throw new NotFoundException('User not found');
			if (user.profileUrl === path) return null;
			const previous = user.profileUrl;
			await repository.update(user.id, { profileUrl: path });
			user.profileUrl = path;
			return { userId: user.id, previous };
		});
		if (!changed || !changed.previous || changed.previous === DEFAULT_AVATAR) return;
		if (process.env.VERCEL) {
			// A copied or malformed record must never delete another user's image
			// or an object in a separate store. Failed cleanup does not undo a save.
			if (this.ownedReplacement(changed.previous, path, changed.userId))
				await del(changed.previous).catch(() => undefined);
		} else {
			await this.deleteImage(changed.previous);
		}
	}

	async deleteImage(path: string): Promise<any> {
		const fs = await import('fs/promises');
		const root = resolve(process.cwd(), 'profiles');
		const safe = resolve(root, basename(path));
		if (safe.startsWith(root + sep) && safe !== resolve(root, 'default.jpeg'))
			await fs.unlink(safe).catch(() => undefined);
	}
}
