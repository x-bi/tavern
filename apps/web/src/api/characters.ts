/**
 * 角色 API 封装（路由前缀 /characters）。
 *
 * 提供 CRUD、导入导出与列表查询；除导入复用 shared 类型外，
 * 其余前端类型（Character 等）在本文件定义。
 */
import { requestJson } from './http';
import type {
  CharacterExportResponse,
  CharacterImportPayload,
  CharacterImportResponse as SharedCharacterImportResponse,
  ModuleImportTemplateResponse,
  ContentLibraryScope
} from '@tavern/shared';
import type {
  CharacterMetadata,
  CharacterMutationPayload,
  ExampleMessage
} from '../types/character';

/** 角色完整数据（前端使用的形态，含 exampleMessages 与 metadata）。 */
export type Character = {
  /** 角色 ID。 */
  id: string;
  /** 所属用户 ID。 */
  userId: string;
  /** 头像资源 ID；无头像时为 null。 */
  avatarAssetId: string | null;
  /** 头像访问 URL；无头像时为 null。 */
  avatarUrl: string | null;
  /** 角色名。 */
  name: string;
  /** 角色描述。 */
  description: string;
  /** 性格。 */
  personality: string;
  /** 场景设定。 */
  scenario: string;
  /** 首条消息。 */
  firstMessage: string;
  /** 对话示例。 */
  exampleMessages: ExampleMessage[];
  /** 角色元数据；无则为 null。 */
  metadata: CharacterMetadata | null;
  /** 是否已归档。 */
  isArchived: boolean;
  /** 是否标记为敏感内容。 */
  isSensitive: boolean;
  isShared: boolean;
  isOwner: boolean;
  ownerName: string | null;
  canFork: boolean;
  /** 创建时间（ISO 字符串）。 */
  createdAt: string;
  /** 最近更新时间（ISO 字符串）。 */
  updatedAt: string;
};

/** 角色列表查询参数，所有字段可选。 */
export type CharacterListParams = {
  /** 页码，从 1 开始。 */
  page?: number;
  /** 每页条数。 */
  pageSize?: number;
  /** 名称搜索关键字。 */
  search?: string;
  /** 是否只看归档角色。 */
  isArchived?: boolean;
  scope?: ContentLibraryScope;
};

/** 角色列表分页结果。 */
export type CharacterListResult = {
  /** 当前页角色。 */
  items: Character[];
  /** 符合条件的总条数。 */
  total: number;
  /** 当前页码。 */
  page: number;
  /** 当前每页条数。 */
  pageSize: number;
};

/** 删除角色的结果。 */
export type CharacterDeleteResult = {
  /** 固定为 true，表示删除成功。 */
  deleted: true;
  /** 被删除的角色 ID。 */
  id: string;
};

/** 角色导入响应，泛型填充为前端 Character 类型。 */
export type CharacterImportResponse = SharedCharacterImportResponse<Character>;

/**
 * API 客户端错误：后端返回失败响应时抛出，携带业务错误码与可选详情。
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * 查询角色列表。GET /characters
 * @param params 分页与过滤参数。
 * @returns 角色列表分页结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function fetchCharacters(
  params: CharacterListParams = {}
): Promise<CharacterListResult> {
  const response = await requestJson<CharacterListResult>(`/characters${toQueryString(params)}`);

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 获取单个角色。GET /characters/:id
 * @param id 角色 ID。
 * @returns 角色完整数据。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function fetchCharacter(id: string): Promise<Character> {
  const response = await requestJson<Character>(`/characters/${id}`);

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

export async function forkCharacter(id: string): Promise<Character> {
  const response = await requestJson<Character>(`/characters/${id}/fork`, { method: 'POST' });
  if (!response.success)
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  return response.data;
}

/**
 * 创建角色。POST /characters
 * @param payload 角色创建载荷。
 * @returns 新建的角色。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function createCharacter(payload: CharacterMutationPayload): Promise<Character> {
  const response = await requestJson<Character>('/characters', {
    method: 'POST',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 更新角色。PUT /characters/:id
 * @param id 角色 ID。
 * @param payload 角色更新载荷。
 * @returns 更新后的角色。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function updateCharacter(
  id: string,
  payload: CharacterMutationPayload
): Promise<Character> {
  const response = await requestJson<Character>(`/characters/${id}`, {
    method: 'PUT',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 删除角色。DELETE /characters/:id
 * @param id 角色 ID。
 * @returns 删除结果。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function deleteCharacter(id: string): Promise<CharacterDeleteResult> {
  const response = await requestJson<CharacterDeleteResult>(`/characters/${id}`, {
    method: 'DELETE'
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 导入角色卡（V2 JSON）。POST /characters/import
 *
 * 支持两阶段：payload.commit=false 仅预览，commit=true 才落库。
 * @param payload 导入入参（含原始 JSON 与提交标志）。
 * @returns 导入响应（含预览与落库后的角色）。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function importCharacterJson(
  payload: CharacterImportPayload
): Promise<CharacterImportResponse> {
  const response = await requestJson<CharacterImportResponse>('/characters/import', {
    method: 'POST',
    body: payload
  });

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/** 下载角色卡导入模板。GET /characters/import-template */
export async function fetchCharacterImportTemplate(): Promise<ModuleImportTemplateResponse> {
  const response = await requestJson<ModuleImportTemplateResponse>('/characters/import-template');

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 导出角色卡。GET /characters/:id/export
 * @param id 角色 ID。
 * @returns 导出响应（含 V2 角色卡结构）。
 * @throws ApiClientError 后端返回失败时抛出。
 */
export async function exportCharacterJson(id: string): Promise<CharacterExportResponse> {
  const response = await requestJson<CharacterExportResponse>(`/characters/${id}/export`);

  if (!response.success) {
    throw new ApiClientError(response.error.message, response.error.code, response.error.details);
  }

  return response.data;
}

/**
 * 把列表查询参数拼成 query string。
 *
 * 仅把实际传入的字段写入 URLSearchParams，undefined 的跳过；
 * 无任何字段时返回空字符串（不产生 `?`）。
 */
function toQueryString(params: CharacterListParams): string {
  const query = new URLSearchParams();

  if (params.page !== undefined) {
    query.set('page', String(params.page));
  }

  if (params.pageSize !== undefined) {
    query.set('pageSize', String(params.pageSize));
  }

  if (params.search) {
    query.set('search', params.search);
  }

  if (params.isArchived !== undefined) {
    query.set('isArchived', String(params.isArchived));
  }
  if (params.scope) query.set('scope', params.scope);

  const value = query.toString();

  return value ? `?${value}` : '';
}
