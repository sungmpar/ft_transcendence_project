import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import { MAX_AVATAR_BYTES } from './avatar-normalization';

// Decode/validate in ProfileService before any Blob or local filesystem write.
export const multerDiskOptions = {
  storage: memoryStorage(),
  fileFilter: (_req: unknown, file: { mimetype: string }, cb: (error: Error | null, accept: boolean) => void) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype);
    cb(allowed ? null : new BadRequestException('Unsupported avatar format'), allowed);
  },
  limits: { fieldNameSize: 20, fieldSize: 1024, fields: 1, fileSize: MAX_AVATAR_BYTES, files: 1, parts: 2 },
};
