import { Injectable, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { EmailService } from './email.service';
import { RedisService } from '../infra/redis.service';
import { jwtSecret } from './auth-configuration';

const CODE_TTL_SECONDS = 600;
const MAX_ATTEMPTS = 5;
type LocalCode = { digest: string; expiresAt: number; attempts: number };

@Injectable()
export class AuthService {
	// The in-process fallback is only for local runs and isolated fixtures.
	private readonly codes = new Map<string, LocalCode>();

	constructor(
		private readonly jwtService: JwtService,
		private readonly emailService: EmailService,
		@Optional() private readonly redis?: RedisService,
	) {}

	private key(email: string): string {
		// Preview and production must never share an email-code namespace.
		const namespace = (process.env.AUTH_REDIS_NAMESPACE || process.env.VERCEL_URL || 'local')
			.replace(/[^a-zA-Z0-9:_-]/g, '_');
		return `ft:2fa:${namespace}:${email.trim().toLowerCase()}`;
	}

	private digest(code: string): string {
		return createHash('sha256')
			.update(`${jwtSecret()}:${code}`)
			.digest('hex');
	}

	async issueJwtToken(username: string) {
		return this.jwtService.sign(
			{ username },
			{ secret: jwtSecret(), expiresIn: '10800s' },
		);
	}

	async createCode(email: string): Promise<string> {
		const code = randomInt(0, 1000000).toString().padStart(6, '0');
		const key = this.key(email);
		const digest = this.digest(code);
		if (this.redis?.enabled) {
			await this.redis.client.eval(`
				redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
				redis.call('DEL', KEYS[2])
				return 1
			`, 2, key, `${key}:attempts`, digest, CODE_TTL_SECONDS);
		} else {
			this.codes.set(key, {
				digest,
				expiresAt: Date.now() + CODE_TTL_SECONDS * 1000,
				attempts: 0,
			});
		}
		// A code is revealed only to the mail sender, never in logs.
		return code;
	}

	async sendJoinMail(email: string, code: string) {
		await this.emailService.sendJoinMail(email, code);
	}

	async verifyCode(email: string, code: string): Promise<boolean> {
		if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return false;
		const key = this.key(email);
		let stored: string | undefined;
		if (this.redis?.enabled) {
			// Checking and consuming must be one atomic operation: two functions
			// may verify the same code simultaneously during reconnect or retries.
			const result = await this.redis.client.eval(`
				local stored = redis.call('GET', KEYS[1])
				if not stored then return 0 end
				local attempts = redis.call('INCR', KEYS[2])
				if attempts == 1 then redis.call('EXPIRE', KEYS[2], ARGV[3]) end
				if attempts > tonumber(ARGV[2]) then return 0 end
				if stored ~= ARGV[1] then return 0 end
				redis.call('DEL', KEYS[1], KEYS[2])
				return 1
			`, 2, key, `${key}:attempts`, this.digest(code), MAX_ATTEMPTS, CODE_TTL_SECONDS);
			return Number(result) === 1;
		} else {
			const current = this.codes.get(key);
			if (!current || current.expiresAt <= Date.now()) {
				this.codes.delete(key);
				return false;
			}
			if (++current.attempts > MAX_ATTEMPTS) return false;
			stored = current.digest;
		}
		if (!stored || !/^[0-9a-f]{64}$/.test(stored)) return false;
		const verified = timingSafeEqual(
			Buffer.from(stored, 'hex'),
			Buffer.from(this.digest(code), 'hex'),
		);
		if (verified) {
			this.codes.delete(key);
		}
		return verified;
	}
}
