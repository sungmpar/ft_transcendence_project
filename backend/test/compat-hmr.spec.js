const { resolveInstalledHmr } = require('../../scripts/compat-hmr-config.cjs');

describe('installed Vue CLI / WDS browser-facing HMR URL', () => {
  const publicOrigin = 'https://transcendence.koreacentral.cloudapp.azure.com';
  for (const override of [undefined, '']) {
    it(`uses public browser origin rather than the inferred private LAN when override is ${String(override)}`, async () => {
      const result = await resolveInstalledHmr({ origin: publicOrigin, override });
      expect(result.url).toBe('wss://transcendence.koreacentral.cloudapp.azure.com/ws');
      expect(result.allowedHosts).toEqual(['transcendence.koreacentral.cloudapp.azure.com', '4.218.8.163']);
    });
  }
  it('uses a direct local browser port', async () => {
    expect((await resolveInstalledHmr({ origin: 'http://127.0.0.1:41327' })).url).toBe('ws://127.0.0.1:41327/ws');
  });
  it('uses a reverse proxy browser port and secure protocol, without exposing internal port3000', async () => {
    expect((await resolveInstalledHmr({ origin: 'https://localhost:44431' })).url).toBe('wss://localhost:44431/ws');
  });
  it('retains an explicit public WSS override', async () => {
    const override = 'wss://hmr.example.com:444/ws';
    expect((await resolveInstalledHmr({ origin: publicOrigin, override })).url).toBe(override);
  });
  it('retains a valid explicit local development override', async () => {
    const override = 'ws://127.0.0.1:41329/ws';
    expect((await resolveInstalledHmr({ origin: 'http://localhost:41327', override })).url).toBe(override);
  });
  it('rejects malformed override through the installed dev-server URL parser', async () => {
    await expect(resolveInstalledHmr({ origin: publicOrigin, override: 'not a URL' })).rejects.toThrow(/Invalid URL/);
  });
  it('documents the explicit-private-override limit without making a network request', async () => {
    const override = 'ws://172.18.0.3:3000/ws';
    const result = await resolveInstalledHmr({ origin: publicOrigin, override });
    expect(result.url).toBe(override);
    expect(new URL(result.url).origin).not.toBe(new URL(publicOrigin.replace('https:', 'wss:')).origin);
  });
});
