/**
 * 应用级备份导入导出 API 封装（路由前缀 /backups）。
 *
 * 导出返回二进制 blob（非 JSON），需从 Content-Disposition 提取文件名；
 * 导出走 requestJson 的 JSON 通道。
 */
import type { ApplicationBackupImportResponse } from '@tavern/shared';

import { authHeaders, requestJson, toApiUrl } from './http';

/** 备份导出的下载结果。 */
export type BackupDownload = {
  /** 备份文件二进制内容。 */
  blob: Blob;
  /** 建议保存的文件名。 */
  filename: string;
};

/**
 * 备份请求错误：导入或导出失败时抛出。
 * 携带业务错误码与可选详情。
 */
export class BackupClientError extends Error {
  constructor(
    message: string,
    /** 业务错误码；HTTP 层失败时用 HTTP_<状态码>。 */
    readonly code: string,
    /** 可选补充详情。 */
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'BackupClientError';
  }
}

/** 备份失败响应体的内部解析类型（统一错误结构）。 */
type ApiErrorPayload = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/**
 * 导出应用备份。GET /backups/export
 *
 * 响应为二进制 JSON 文件，返回 blob 与从 Content-Disposition 提取的文件名。
 * @returns 备份下载结果。
 * @throws BackupClientError 导出失败时抛出。
 */
export async function exportApplicationBackup(): Promise<BackupDownload> {
  const response = await fetch(toApiUrl('/backups/export'), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...authHeaders()
    }
  });

  // 非 2xx：尝试从响应体解析统一错误结构再抛
  if (!response.ok) {
    await throwBackupError(response);
  }

  return {
    blob: await response.blob(),
    filename: getDownloadFilename(response.headers.get('Content-Disposition'))
  };
}

/**
 * 导入应用备份（整库覆盖写）。POST /backups/import
 * @param rawJson 备份文件的原始 JSON 字符串。
 * @param confirmOverwrite 是否确认覆盖写库（后端要求显式确认）。
 * @returns 导入结果（含数量统计与告警）。
 * @throws BackupClientError 导入失败时抛出。
 */
export async function importApplicationBackup(
  rawJson: string,
  confirmOverwrite: boolean
): Promise<ApplicationBackupImportResponse> {
  const response = await requestJson<ApplicationBackupImportResponse>('/backups/import', {
    method: 'POST',
    body: {
      rawJson,
      confirmOverwrite
    }
  });

  if (!response.success) {
    throw new BackupClientError(
      response.error.message,
      response.error.code,
      response.error.details
    );
  }

  return response.data;
}

/**
 * 从失败的导出响应中解析错误并抛出 BackupClientError。
 *
 * 流程：尝试解析为统一错误结构 → 命中则抛对应错误 →
 * 解析失败或非预期结构 → 抛通用的"备份导出失败"错误（带 HTTP 状态码）。
 *
 * @param response 失败的导出响应。
 * @returns 永不返回（始终抛错）。
 */
async function throwBackupError(response: Response): Promise<never> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;

    // 命中统一错误结构：抛出带 code/details 的错误
    if (payload.success === false) {
      throw new BackupClientError(payload.error.message, payload.error.code, payload.error.details);
    }
  } catch (error) {
    // 已经是 BackupClientError 的直接向上抛，避免被下面的兜底覆盖
    if (error instanceof BackupClientError) {
      throw error;
    }
    // 其它解析异常落到兜底
  }

  // 兜底：响应体不是统一错误结构，抛通用的导出失败错误
  throw new BackupClientError('备份导出失败。', `HTTP_${response.status}`);
}

/**
 * 从 Content-Disposition 头解析下载文件名。
 *
 * 匹配 `filename="xxx"` 形式；匹配不到或无该头时回退到默认文件名。
 *
 * @param contentDisposition Content-Disposition 头的值，可能为 null。
 * @returns 解析出的文件名，或默认的 tavern-lite-backup.json。
 */
function getDownloadFilename(contentDisposition: string | null): string {
  if (!contentDisposition) {
    return 'tavern-lite-backup.json';
  }

  // 提取 filename="..." 中的文件名；正则只匹配双引号包裹的值
  const match = /filename="([^"]+)"/.exec(contentDisposition);

  return match?.[1] ?? 'tavern-lite-backup.json';
}
