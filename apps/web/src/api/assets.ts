/**
 * 资源（上传文件）API 封装（路由前缀 /assets）。
 *
 * 上传用 multipart/form-data（FormData），不走 requestJson 的 JSON 通道。
 */
import type { ApiResponse } from '@tavern/shared';

import { API_BASE_URL, authHeaders } from './http';

/** 已上传资源的元信息。 */
export type Asset = {
  /** 资源 ID。 */
  id: string;
  /** 所属用户 ID。 */
  userId: string;
  /** 资源类型标识（如 image）。 */
  kind: string;
  /** 存储文件名（去重命名后的）。 */
  fileName: string;
  /** 原始文件名；无则为 null。 */
  originalName: string | null;
  /** MIME 类型。 */
  mimeType: string;
  /** 扩展名（不含点）；无则为 null。 */
  extension: string | null;
  /** 文件大小（字节）。 */
  sizeBytes: number;
  /** 公开访问路径；未公开时为 null。 */
  publicPath: string | null;
  /** 创建时间（ISO 字符串）。 */
  createdAt: string;
};

/**
 * 资源上传错误：后端返回失败响应时抛出。
 * 携带业务错误码与可选详情。
 */
export class AssetClientError extends Error {
  constructor(
    message: string,
    /** 业务错误码。 */
    readonly code: string,
    /** 可选补充详情。 */
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'AssetClientError';
  }
}

/**
 * 上传文件。POST /assets/upload（multipart/form-data）
 * @param file 待上传的 File 对象（如表单选中的头像图片）。
 * @returns 已上传资源的元信息（含 id 与 publicPath）。
 * @throws AssetClientError 后端返回失败时抛出。
 */
export async function uploadAsset(file: File): Promise<Asset> {
  const body = new FormData();

  body.set('file', file);

  const response = await fetch(`${API_BASE_URL}/assets/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body
  });
  const payload = (await response.json()) as ApiResponse<Asset>;

  if (!payload.success) {
    throw new AssetClientError(
      payload.error.message,
      payload.error.code,
      payload.error.details
    );
  }

  return payload.data;
}
