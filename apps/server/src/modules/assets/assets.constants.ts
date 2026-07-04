import { basename, dirname, join } from 'node:path';

// 检测工作目录：若从 apps/server 启动，则取上两级（仓库根）作为 uploads 根；
// 否则用当前目录（兼容从仓库根启动）
const currentWorkingDirectory = process.cwd();
const workspaceRoot =
  basename(currentWorkingDirectory) === 'server' &&
  basename(dirname(currentWorkingDirectory)) === 'apps'
    ? dirname(dirname(currentWorkingDirectory))
    : currentWorkingDirectory;

/** 上传文件根目录（仓库根/uploads）。 */
export const UPLOADS_ROOT = join(workspaceRoot, 'uploads');
/** 角色头像上传相对路径。 */
export const CHARACTER_AVATAR_UPLOAD_PATH = 'avatars/characters';
/** 角色头像上传绝对路径。 */
export const CHARACTER_AVATAR_UPLOAD_ROOT = join(UPLOADS_ROOT, CHARACTER_AVATAR_UPLOAD_PATH);
/** 角色头像最大 2MB。 */
export const CHARACTER_AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;
/** 角色头像的素材类型标识（characters.service 校验头像归属时用）。 */
export const CHARACTER_AVATAR_KIND = 'character-avatar';

/** 允许的 MIME → 扩展名映射（fileFilter 校验和入库取扩展名都用它）。 */
export const CHARACTER_AVATAR_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};
