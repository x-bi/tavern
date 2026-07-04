/** multer 上传文件的形状（FileInterceptor 注入的 file 对象）。 */
export type UploadedAvatarFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

/** 素材对外响应体。 */
export type AssetResponse = {
  id: string;
  userId: string;
  /** 素材类型，如 character-avatar。 */
  kind: string;
  /** 存储文件名（UUID + 扩展名）。 */
  fileName: string;
  /** 用户上传时的原始文件名。 */
  originalName: string | null;
  mimeType: string;
  /** 扩展名（由 mimeType 推导）。 */
  extension: string | null;
  sizeBytes: number;
  /** 公开访问路径，形如 /uploads/avatars/characters/xxx.png。 */
  publicPath: string | null;
  createdAt: string;
};
