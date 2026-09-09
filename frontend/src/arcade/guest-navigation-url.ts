/** Literal-address checks only: a hostname can still resolve to a private IP.
 * No DNS lookup or network probe is performed to decide a login destination.
 */
function localIpv4(parts: number[]): boolean {
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}
function localAddress(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return localIpv4(host.split('.').map(Number));
  if (!host.startsWith('[')) return false;
  const halves = host.slice(1, -1).split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const groups = (halves.length === 2
    ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left)
    .map(value => parseInt(value, 16));
  if (groups.every(value => value === 0) ||
    (groups.slice(0, 7).every(value => value === 0) && groups[7] === 1) ||
    (groups[0] & 0xfe00) === 0xfc00 || (groups[0] & 0xffc0) === 0xfe80) return true;
  if (groups.slice(0, 5).every(value => value === 0) && (groups[5] === 0xffff || groups[5] === 0)) {
    return localIpv4([groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255]);
  }
  return false;
}

/** Keep same-origin/base-path and local development contracts. Cross-host
 * public URLs still require a separately supported cookie/callback deployment.
 */
export function resolveGuestLoginUrl(backendOverride: string | undefined, pageUrl: string): string | null {
  try {
    const page = new URL(pageUrl);
    if (!['http:', 'https:'].includes(page.protocol)) return null;
    const configured = backendOverride || page.origin;
    const destination = new URL(configured, page.origin);
    const authority = configured.match(/^(?:[a-z][a-z\d+.-]*:)?\/\/([^/?#]*)/i)?.[1];
    if (!['http:', 'https:'].includes(destination.protocol) || destination.username || destination.password ||
      authority?.includes('@') || destination.href.includes('?') || destination.href.includes('#')) return null;
    if (!localAddress(page.hostname) && (localAddress(destination.hostname) ||
      (page.protocol === 'https:' && destination.protocol !== 'https:'))) return null;
    destination.pathname = destination.pathname.replace(/\/$/, '') + '/auth/guest';
    return destination.href;
  } catch { return null; }
}
