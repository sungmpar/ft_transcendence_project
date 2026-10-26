const PLACEHOLDER = /replace[_\s-]*with|change[_\s-]*me|placeholder|^your[_\s-]|^undefined$|^null$|test[_\s-]*only/i;

function configuredValue(value: string | undefined): value is string {
  return Boolean(value?.trim()) && !PLACEHOLDER.test(value);
}

/** Vercel must never start with an absent, example, or trivially short JWT key. */
export function jwtSecret(): string {
  const secret = process.env.SECRET || '';
  if (process.env.VERCEL && (!configuredValue(secret) || secret.trim().length < 32))
    throw new Error('Vercel SECRET must be a unique non-placeholder value of at least 32 characters');
  return secret;
}

/** Only expose capability flags; credentials never leave the server. */
export function oauth42Configured(): boolean {
  if (!configuredValue(process.env.CLIENT_UID) || !configuredValue(process.env.CLIENT_SEC) || !process.env.CALLBACK)
    return false;
  try {
    const callback = new URL(process.env.CALLBACK);
    return ['http:', 'https:'].includes(callback.protocol) &&
      (!process.env.VERCEL || callback.protocol === 'https:') &&
      !PLACEHOLDER.test(callback.hostname);
  } catch { return false; }
}

export function emailConfigured(): boolean {
  return configuredValue(process.env.EMAIL_USER) && configuredValue(process.env.EMAIL_PW);
}

export function frontendOrigin(): string {
  const configured = process.env.FRONT_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const url = new URL(configured);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('FRONT_URL must be an HTTP(S) URL');
  return url.origin;
}
