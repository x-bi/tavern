import { basename, dirname, join } from 'node:path';

const currentWorkingDirectory = process.cwd();
const workspaceRoot =
  basename(currentWorkingDirectory) === 'server' &&
  basename(dirname(currentWorkingDirectory)) === 'apps'
    ? dirname(dirname(currentWorkingDirectory))
    : currentWorkingDirectory;

export const UPLOADS_ROOT = join(workspaceRoot, 'uploads');
export const CHARACTER_AVATAR_UPLOAD_PATH = 'avatars/characters';
export const CHARACTER_AVATAR_UPLOAD_ROOT = join(UPLOADS_ROOT, CHARACTER_AVATAR_UPLOAD_PATH);
export const CHARACTER_AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;
export const CHARACTER_AVATAR_KIND = 'character-avatar';

export const CHARACTER_AVATAR_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};
