export type UploadedAvatarFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type AssetResponse = {
  id: string;
  userId: string;
  kind: string;
  fileName: string;
  originalName: string | null;
  mimeType: string;
  extension: string | null;
  sizeBytes: number;
  publicPath: string | null;
  createdAt: string;
};
