import { BadRequestException } from '@nestjs/common';
const sharp: typeof import('sharp').default = require('sharp');
import { MAX_AVATAR_BYTES, normalizeAvatar } from './avatar-normalization';

async function picture(format: 'png' | 'jpeg', width = 16, height = 16): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 0.5 } } })[format]().toBuffer();
}

describe('avatar upload content boundary', () => {
  it.each(['png', 'jpeg'] as const)('decodes and normalizes valid %s', async format => {
    const output = await normalizeAvatar({ buffer: await picture(format), mimetype: `image/${format}` });
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe('png'); expect(metadata.width).toBe(16); expect(metadata.height).toBe(16);
    expect(metadata.exif).toBeUndefined(); expect(metadata.xmp).toBeUndefined();
  });
  it('accepts image/jpg only for real JPEG pixels', async () => {
    await expect(normalizeAvatar({ buffer: await picture('jpeg'), mimetype: 'image/jpg' })).resolves.toBeInstanceOf(Buffer);
  });
  it('reduces dimensions and preserves aspect ratio', async () => {
    const output = await normalizeAvatar({ buffer: await picture('png', 1024, 512), mimetype: 'image/png' });
    const metadata = await sharp(output).metadata(); expect(metadata.width).toBe(512); expect(metadata.height).toBe(256);
  });
  it.each([undefined, Buffer.alloc(0), Buffer.from('<svg onload="alert(1)"/>'), Buffer.from('<html>not an image</html>')])('rejects absent or spoofed content', async buffer => {
    await expect(normalizeAvatar({ buffer, mimetype: 'image/png' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects forged magic bytes and damaged compressed data', async () => {
    const input = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(100)]);
    await expect(normalizeAvatar({ buffer: input, mimetype: 'image/png' })).rejects.toBeInstanceOf(BadRequestException);
    const valid = await picture('jpeg', 64, 64);
    await expect(normalizeAvatar({ buffer: valid.subarray(0, valid.length - 20), mimetype: 'image/jpeg' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects a valid image with mismatched MIME', async () => {
    await expect(normalizeAvatar({ buffer: await picture('png'), mimetype: 'image/jpeg' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(normalizeAvatar({ buffer: await picture('jpeg'), mimetype: 'image/png' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects oversized input before decoding', async () => {
    await expect(normalizeAvatar({ buffer: Buffer.alloc(MAX_AVATAR_BYTES + 1), mimetype: 'image/png' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects excessive dimensions even if compressed bytes are small', async () => {
    await expect(normalizeAvatar({ buffer: await picture('png', 4097, 1), mimetype: 'image/png' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(normalizeAvatar({ buffer: await picture('png', 3000, 3000), mimetype: 'image/png' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('does not copy trailing payloads into public objects', async () => {
    const input = Buffer.concat([await picture('png'), Buffer.from('<script>unsafe()</script>')]);
    const output = await normalizeAvatar({ buffer: input, mimetype: 'image/png' });
    expect(output.includes(Buffer.from('unsafe()'))).toBe(false);
  });
});
