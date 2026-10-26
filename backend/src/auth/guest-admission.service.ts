import { HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import { isIP } from 'net';
import { RedisService } from '../infra/redis.service';
import { jwtSecret } from './auth-configuration';

interface GuestRequest {
  headers?: Record<string, unknown>;
  socket?: { remoteAddress?: string };
}

const UNAVAILABLE = 'Guest account creation is temporarily unavailable';

// Both keys share one Redis hash slot. Check both budgets before incrementing
// either one, and never extend a window when a request is rejected.
const RESERVE_GUEST = `
local function read(key)
  local raw = redis.call('GET', key)
  if not raw then return 0, -2 end
  if raw ~= '0' and not string.match(raw, '^[1-9]%d*$') then error('Invalid guest admission state') end
  local count = tonumber(raw)
  local ttl = redis.call('PTTL', key)
  if not count or count > 10000000 or ttl < 0 then error('Invalid guest admission state') end
  return count, ttl
end
local ipCount, ipTtl = read(KEYS[1])
local globalCount, globalTtl = read(KEYS[2])
local retry = -1
if ipCount >= tonumber(ARGV[1]) then retry = math.max(retry, ipTtl) end
if globalCount >= tonumber(ARGV[3]) then retry = math.max(retry, globalTtl) end
if retry >= 0 then return {0, math.max(1, retry)} end
redis.call('INCR', KEYS[1])
if ipTtl == -2 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
redis.call('INCR', KEYS[2])
if globalTtl == -2 then redis.call('PEXPIRE', KEYS[2], ARGV[4]) end
return {1, 0}
`;

function positiveInteger(name: string, fallback: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9][0-9]*$/.test(raw)) throw new Error('Invalid guest admission configuration');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > max) throw new Error('Invalid guest admission configuration');
  return value;
}

/** Canonicalize equivalent spellings, including IPv4-mapped IPv6 addresses. */
function canonicalAddress(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 45 || raw.includes('%') || !isIP(raw))
    throw new Error('Untrusted guest request address');
  if (isIP(raw) === 4) return raw;
  let address = raw.toLowerCase();
  if (address.includes('.')) {
    const lastColon = address.lastIndexOf(':');
    const octets = address.slice(lastColon + 1).split('.').map(Number);
    address = `${address.slice(0, lastColon)}:${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  const halves = address.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const words = [...left, ...Array(8 - left.length - right.length).fill('0'), ...right].map(word => parseInt(word, 16));
  if (words.slice(0, 5).every(word => word === 0) && words[5] === 65535)
    return [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255].join('.');
  return words.map(word => word.toString(16).padStart(4, '0')).join(':');
}

function requestAddress(request: GuestRequest): string {
  if (process.env.VERCEL === '1') {
    // Vercel ingress supplies this header. Do not trust Express req.ip,
    // arbitrary forwarding chains, Host, or client-provided proxy headers.
    // https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for
    return canonicalAddress(request.headers?.['x-vercel-forwarded-for']);
  }
  const development = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  if (!process.env.VERCEL && development && process.env.GUEST_ALLOW_LOCAL_LOOPBACK === 'true') {
    const peer = canonicalAddress(request.socket?.remoteAddress);
    if (peer === '0000:0000:0000:0000:0000:0000:0000:0001' || /^127\./.test(peer)) return 'local-loopback';
  }
  throw new Error('Untrusted guest request address');
}

function namespace(): string {
  // Stable across aliases and redeployments. A new immutable deployment URL
  // must not reset the global cap. Preview and production remain separate.
  const hosted = process.env.VERCEL === '1';
  const scope = process.env.AUTH_REDIS_NAMESPACE || process.env.VERCEL_PROJECT_ID || (!hosted ? 'local' : '');
  const environment = hosted ? process.env.VERCEL_ENV : 'local';
  if (!scope || scope.length > 256 || !['preview', 'production', 'development', 'local'].includes(environment))
    throw new Error('Invalid guest admission configuration');
  return createHash('sha256').update(`${scope}\0${environment}`).digest('hex').slice(0, 32);
}

export class GuestAdmissionLimitException extends HttpException {
  constructor(readonly retryAfter: number) {
    super({ statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Guest account creation limit reached. Please try again later.', retryAfter }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class GuestAdmissionService {
  constructor(private readonly redis: RedisService) {}

  async reserve(request: GuestRequest): Promise<void> {
    try {
      const client = this.redis.client;
      if (!client) throw new Error('Guest admission store unavailable');
      const ipLimit = positiveInteger('GUEST_IP_LIMIT', 10, 1000);
      const ipSeconds = positiveInteger('GUEST_IP_WINDOW_SECONDS', 3600, 86400);
      const globalLimit = positiveInteger('GUEST_GLOBAL_LIMIT', 100, 10000);
      const globalSeconds = positiveInteger('GUEST_GLOBAL_WINDOW_SECONDS', 86400, 604800);
      const address = requestAddress(request);
      const secret = jwtSecret();
      if (!secret) throw new Error('Guest admission key unavailable');
      // No raw address, credential, or address-bearing argument is sent to
      // Redis or logs. Domain separation prevents reuse as a JWT signature.
      const digest = createHmac('sha256', secret).update('ft-transcendence/guest-admission/v1\0').update(address).digest('hex');
      const prefix = `ft:guest:{${namespace()}}`;
      const reply = await client.eval(RESERVE_GUEST, 2, `${prefix}:ip:${digest}`, `${prefix}:global`,
        ipLimit, ipSeconds * 1000, globalLimit, globalSeconds * 1000);
      if (!Array.isArray(reply) || reply.length !== 2 || !reply.every(value => typeof value === 'number' && Number.isSafeInteger(value)))
        throw new Error('Invalid guest admission reply');
      if (reply[0] === 1 && reply[1] === 0) return;
      if (reply[0] === 0 && reply[1] > 0 && reply[1] <= Math.max(ipSeconds, globalSeconds) * 1000)
        throw new GuestAdmissionLimitException(Math.max(1, Math.ceil(reply[1] / 1000)));
      throw new Error('Invalid guest admission reply');
    } catch (error) {
      if (error instanceof GuestAdmissionLimitException) throw error;
      // Fail closed for new guest creation only, with no internal Redis error,
      // address or credential reflected in an HTTP response or log message.
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
  }
}
