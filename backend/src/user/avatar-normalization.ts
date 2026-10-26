import { BadRequestException } from '@nestjs/common';
const sharp: typeof import('sharp').default = require('sharp');

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_AVATAR_PIXELS = 8_000_000;
const MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Fully decode untrusted pixels, strip metadata/trailing content and emit a bounded PNG. */
export async function normalizeAvatar(file: { buffer?: Buffer; mimetype?: string }): Promise<Buffer> {
  const input = file?.buffer;
  if (!Buffer.isBuffer(input) || input.length === 0 || input.length > MAX_AVATAR_BYTES || !MIME_TYPES.has(file.mimetype))
    throw new BadRequestException('A PNG or JPEG image up to 2 MiB is required');
  const png = input.length >= 8 && input.subarray(0, 8).equals(PNG);
  const jpeg = input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
  if ((!png && !jpeg) || (png && file.mimetype !== 'image/png') || (jpeg && file.mimetype === 'image/png'))
    throw new BadRequestException('Image content does not match its declared type');
  try {
    const image = sharp(input, { failOn: 'warning', limitInputPixels: MAX_AVATAR_PIXELS, sequentialRead: true });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096 ||
        metadata.width * metadata.height > MAX_AVATAR_PIXELS || (metadata.pages || 1) !== 1 ||
        !['png', 'jpeg'].includes(metadata.format)) throw new Error('Unsupported image dimensions');
    // Sharp removes EXIF/ICC/XMP by default. Never retain attacker-supplied metadata.
    const { data, info } = await image.rotate().resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 6 }).toBuffer({ resolveWithObject: true });
    if (data.length > MAX_AVATAR_BYTES || info.width > 512 || info.height > 512) throw new Error('Invalid normalized image');
    return data;
  } catch {
    throw new BadRequestException('The image is damaged or exceeds the allowed dimensions');
  }
}
