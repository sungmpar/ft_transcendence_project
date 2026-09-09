import { resolveGuestLoginUrl } from '../../../frontend/src/arcade/guest-navigation-url';

describe('guest document destination respects the existing deployment boundary', () => {
  const publicPage = 'https://game.example/login?next=/spectate';
  test.each([
    [undefined, publicPage, 'https://game.example/auth/guest'],
    ['', publicPage, 'https://game.example/auth/guest'],
    ['/api', publicPage, 'https://game.example/api/auth/guest'],
    ['https://api.example', publicPage, 'https://api.example/auth/guest'],
    [
      'https://game.example:8443/',
      publicPage,
      'https://game.example:8443/auth/guest',
    ],
    [
      'http://127.0.0.1:5000',
      'http://127.0.0.1:3000/login',
      'http://127.0.0.1:5000/auth/guest',
    ],
    [
      'http://localhost:5000',
      'http://localhost:3000/login',
      'http://localhost:5000/auth/guest',
    ],
    [
      'http://[::1]:5000',
      'http://[::1]:3000/login',
      'http://[::1]:5000/auth/guest',
    ],
  ])('preserves a supported URL shape (%s)', (override, page, expected) => {
    expect(resolveGuestLoginUrl(override, page as string)).toBe(expected);
  });
  test.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///tmp/app',
    'https://user:password@api.example',
    'https://@api.example',
    'https://api.example?secret=redacted',
    'https://api.example?',
    'https://api.example#fragment',
    'https://api.example#',
    'http://localhost:5000',
    'http://localhost.:5000',
    'http://demo.localhost:5000',
    'http://0.0.0.0',
    'http://127.2.3.4',
    'http://2130706433',
    'http://0x7f000001',
    'http://10.1.2.3',
    'http://172.18.0.3:3000',
    'http://192.168.1.2',
    'http://169.254.1.2',
    'http://[::1]',
    'http://[::]',
    'http://[fc00::1]',
    'http://[fd00::1]',
    'http://[fe80::1]',
    'http://[::ffff:127.0.0.1]',
    'http://[::ffff:c0a8:0102]',
  ])('rejects an unsafe or ambiguous public-page override (%s)', (override) => {
    expect(resolveGuestLoginUrl(override, publicPage)).toBeNull();
  });
  test.each([
    'localhost',
    '0x7f000001',
    '10.1.2.3',
    '172.18.0.3',
    '192.168.1.2',
    '169.254.1.2',
    '[::1]',
    '[fc00::1]',
    '[fe80::1]',
    '[::ffff:c0a8:0102]',
  ])('rejects private destinations without a scheme downgrade (%s)', (host) => {
    expect(resolveGuestLoginUrl(`https://${host}`, publicPage)).toBeNull();
    expect(
      resolveGuestLoginUrl(`http://${host}`, 'http://game.example/login'),
    ).toBeNull();
  });
  test('preserves public HTTP development without requiring HTTPS', () => {
    expect(
      resolveGuestLoginUrl('http://api.example', 'http://game.example/login'),
    ).toBe('http://api.example/auth/guest');
  });
  test('does not pretend a public hostname proves its DNS address space', () => {
    expect(
      resolveGuestLoginUrl('https://configured-public.example', publicPage),
    ).toBe('https://configured-public.example/auth/guest');
  });
  test('does not downgrade a public HTTPS login to a public HTTP backend', () => {
    expect(resolveGuestLoginUrl('http://api.example', publicPage)).toBeNull();
    expect(
      resolveGuestLoginUrl(
        'http://127.0.0.1:5000',
        'http://127.0.0.1:3000/login',
      ),
    ).toBe('http://127.0.0.1:5000/auth/guest');
    expect(resolveGuestLoginUrl('https://api.example', publicPage)).toBe(
      'https://api.example/auth/guest',
    );
  });
  test('rejects an invalid page context without causing a request', () => {
    expect(resolveGuestLoginUrl('', 'not a URL')).toBeNull();
    expect(resolveGuestLoginUrl('', 'file:///local/index.html')).toBeNull();
  });
});
