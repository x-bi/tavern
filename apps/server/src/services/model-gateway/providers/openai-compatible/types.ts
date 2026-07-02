import type {
  ModelGatewayMessage,
  ModelGatewayRequestOptions,
  ModelGatewayTokenUsage
} from '../../types';

export type OpenAICompatibleMessage = Pick<ModelGatewayMessage, 'role' | 'content' | 'name'> & {
  tool_call_id?: string;
};

export type OpenAICompatibleChatRequest = {
  model: string;
  messages: OpenAICompatibleMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  stream: boolean;
};

export type OpenAICompatibleChatChoice = {
  index?: number;
  message?: {
    role?: string;
    content?: string | null;
  };
  delta?: {
    role?: string;
    content?: string | null;
  };
  finish_reason?: string | null;
};

export type OpenAICompatibleChatResponse = {
  id?: string;
  model?: string;
  text?: string | null;
  finish_reason?: string | null;
  output?: {
    text?: string | null;
  } | null;
  choices?: OpenAICompatibleChatChoice[];
  usage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
  } | null;
  error?: OpenAICompatibleProviderError;
};

export type OpenAICompatibleProviderError = {
  message?: unknown;
  code?: unknown;
  type?: unknown;
};

export type OpenAICompatibleLogEntry = {
  providerName: string;
  modelName: string;
  operation: 'testConnection' | 'chat' | 'streamChat';
  status: 'started' | 'succeeded' | 'failed';
  statusCode?: number | null;
  latencyMs?: number;
};

export type OpenAICompatibleRequestOptions = ModelGatewayRequestOptions & {
  operation: OpenAICompatibleLogEntry['operation'];
};

export type OpenAICompatibleHttpResult = {
  response: Response;
  requestId: string;
  cleanup: () => void;
};

export type OpenAICompatibleUsage = ModelGatewayTokenUsage;
