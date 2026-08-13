/**
 * shared 包桶文件：集中重导出前后端共享的稳定类型契约与常量。
 *
 * 前后端统一从 `@tavern/shared` 导入，不直接引用内部子模块路径。
 * 这里只放跨端稳定契约，不放业务实现。
 */
export type { ApiError, ApiResponse } from './api';
export { AI_IMPORT_MODES, AI_IMPORT_TARGETS } from './ai-import';
export type {
  AiImportDecision,
  AiImportDecisionBasis,
  AiImportDecisionConfidence,
  AiImportMode,
  AiImportModeOption,
  AiImportOptionsResponse,
  AiImportPreview,
  AiImportSafeModelMetadata,
  AiImportStrategyOption,
  AiImportTarget,
  AiImportTargetOption,
  AiImportTransformPayload,
  AiImportTransformResult,
  AiImportValidatePayload,
  AiImportValidationError,
  AiImportValidationResult,
  AiImportWarning
} from './ai-import';
export { APPLICATION_BACKUP_FORMAT_VERSION } from './backup';
export type {
  ApplicationBackupExport,
  ApplicationBackupImportPayload,
  ApplicationBackupImportResponse,
  ApplicationBackupImportSummary,
  ApplicationBackupSecurity,
  ApplicationBackupSetting,
  BackupJsonRecord,
  BackupSettingsPolicy
} from './backup';
export type {
  CharacterExportCard,
  CharacterExportCardData,
  CharacterExportResponse
} from './character-export';
export type {
  CharacterImportDuplicateNameStrategy,
  CharacterImportExampleMessage,
  CharacterImportFieldAction,
  CharacterImportFieldMapping,
  CharacterImportPayload,
  CharacterImportPreview,
  CharacterImportResponse,
  CharacterImportWarning
} from './character-import';
export { CHARACTER_CARD_SPEC, CHARACTER_CARD_SPEC_VERSION } from './character-import';
export type {
  ChatSuggestion,
  ChatSuggestionPayload,
  ChatSuggestionResult,
  ChatStreamDeltaEvent,
  ChatStreamDoneEvent,
  ChatStreamErrorEvent,
  ChatStreamPayload
} from './chat';
export {
  createClientOperationId,
  createGenerationRequestId,
  createProvisionalAssistant,
  reduceProvisionalAssistant
} from './chat-provisional';
export type { ProvisionalAssistantEvent, ProvisionalAssistantState } from './chat-provisional';
export { CONTENT_PACK_FORMAT_VERSION } from './content-pack';
export type {
  ContentPackCharacter,
  ContentPackDocument,
  ContentPackDuplicateStrategy,
  ContentPackImportConflict,
  ContentPackImportPayload,
  ContentPackImportPreview,
  ContentPackImportResponse,
  ContentPackImportResult,
  ContentPackImportSummary,
  ContentPackImportWarning,
  ContentPackMessage,
  ContentPackMessageRole,
  ContentPackPersona,
  ContentPackPromptPreset,
  ContentPackStarterConversation,
  ContentPackWorldBook,
  ContentPackWorldBookEntry
} from './content-pack';
export type { ContentLibraryFields, ContentLibraryScope } from './content-library';
export { COMPANION_FORMAT_VERSION } from './companion';
export type {
  CompanionChatStreamPayload,
  CompanionExportResponse,
  CompanionImportPreview,
  CompanionImportResponse,
  CompanionImportTemplateResponse,
  CompanionListResponse,
  CompanionMemoryPayload,
  CompanionMemoryResponse,
  CompanionMemoryRevisionResponse,
  CompanionMemoryStatus,
  CompanionMessageResponse,
  CompanionMessageStatus,
  CompanionPayload,
  CompanionPromptPreviewResponse,
  CompanionResponse
} from './companion';
export type {
  ConversationImageGenerationConfigPayload,
  ConversationImageStyleOption,
  ConversationCharacterSummary,
  ConversationClearResponse,
  ConversationListResponse,
  ConversationModelFallbackGroupSummary,
  ConversationPayload,
  ConversationPersonaSummary,
  ConversationPromptPresetSummary,
  ConversationResponse,
  ConversationStatus,
  ConversationUpdatePayload
} from './conversation';
export {
  DEFAULT_CONVERSATION_IMAGE_GENERATION_CONFIG,
  IMAGE_ASPECT_RATIOS,
  IMAGE_STYLE_PRESETS
} from './image-generation';
export type {
  AdminImageDetailResponse,
  AdminImageListItem,
  AdminImageListResponse,
  ConversationImageGenerationConfig,
  ConversationMessageImagesResponse,
  CreateImageGenerationPayload,
  ImageAspectRatio,
  ImageCount,
  ImageDetailResponse,
  ImageGenerationBatchResponse,
  ImageGenerationBatchStatus,
  ImageListItem,
  ImageListResponse,
  ImageStylePreset,
  SceneImage,
  SceneImageSnapshot,
  ScenePromptModelOutput
} from './image-generation';
export type {
  CompiledPrompt,
  CompiledPromptSection,
  ContentTrustLevel,
  ExecutionMode,
  GenerationPurpose,
  PromptCapabilities,
  PromptImportance,
  PromptPlacementV2,
  PromptSectionKindV2,
  PromptSectionV2,
  WorldBookContentType
} from './context-engine';
export type {
  ModelConnectionTestResponse,
  ModelCapability,
  ModelFallbackCandidatePayload,
  ModelFallbackCandidateResponse,
  ModelFallbackGroupListResponse,
  ModelFallbackGroupPayload,
  ModelFallbackGroupResponse,
  ModelProviderListResponse,
  ModelProviderPayload,
  ModelProviderResponse,
  ProviderModelListResponse,
  ProviderModelPayload,
  ProviderModelResponse,
  SupportedModelProvidersResponse
} from './model';
export type {
  ModelGatewayChatResult,
  ModelGatewayConnectionTestResult,
  ModelGatewayMessage,
  ModelGatewayMessageRole,
  ModelGatewayProviderOptions,
  ModelGatewayStreamDeltaEvent,
  ModelGatewayStreamDoneEvent,
  ModelGatewayStreamErrorEvent,
  ModelGatewayStreamEvent,
  ModelGatewayStreamPingEvent,
  ModelGatewayTokenUsage
} from './model-gateway';
export type {
  ModuleImportDuplicateNameStrategy,
  ModuleImportPayload,
  ModuleImportPreviewBase,
  ModuleImportTemplateResponse,
  ModuleImportWarning,
  PersonaImportPreview,
  PersonaImportResponse,
  PromptPresetImportPreview,
  PromptPresetImportResponse,
  WorldBookEntryImportPreview,
  WorldBookImportPreview,
  WorldBookImportResponse
} from './module-import';
export type {
  MessageListResponse,
  MessageRegenerateResponse,
  MessageResponse,
  MessageRole,
  MessageStatus,
  MessageUpdatePayload
} from './message';
export { resolveTimelineTurns } from './timeline';
export type {
  ResolvedTimelineMessage,
  ResolvedTurn,
  TimelineMessage,
  TimelinePolicy,
  TimelineResolver,
  TimelineTarget,
  TimelineTurn,
  TimelineTurnStatus
} from './timeline';
export type { PageQuery, PageResult } from './pagination';
export { PERSONA_FORMAT_VERSION } from './persona';
export type { PersonaListResponse, PersonaPayload, PersonaResponse } from './persona';
export type { ApplicationSettings, ApplicationSettingsPayload } from './settings';
export type {
  QqAccountItem,
  QqAccountPayload,
  QqAccountStatus,
  QqBindingUpdatePayload,
  QqChatBindingItem,
  QqChatBindingPayload,
  QqConnectionTestResult,
  QqFriendItem,
  QqLoginStatus,
  QqLogoutResult,
  QqTargetItem,
  QqTargetType
} from './qq-bridge';
export type {
  CreateShareLinkPayload,
  PublicShareBootstrap,
  PublicShareMessage,
  ShareLinkItem,
  SharePermission,
  ShareStatus,
  ShareTargetEvent,
  ShareTargetEventName,
  ShareTargetType
} from './share';
export type {
  BuildPromptDebugInfo,
  BuildPromptInput,
  ChatMessageLike,
  PromptBuildMode,
  PromptBuildOptions,
  PromptBuildPurpose,
  PromptBuildWarning,
  PromptCharacterContext,
  PromptConversationContext,
  PromptInternalMessageRole,
  PromptMessageRole,
  PromptModelGatewayContext,
  PromptModelParameters,
  PromptPersonaContext,
  PromptPresetContext,
  PromptHistoryTrimInfo,
  PromptPreviewPayload,
  PromptPreviewResponse,
  PromptProviderMessageRole,
  PromptSectionKind,
  PromptTruncatedHistoryItem,
  ProviderChatMessage,
  WorldBookContext,
  WorldBookEntryContext
} from './prompt-builder';
export {
  PROMPT_PRESET_DEFAULT_GENERATION_PURPOSES,
  PROMPT_PRESET_FORMAT_VERSION,
  PROMPT_PRESET_GENERATION_PURPOSES,
  PROMPT_PRESET_OUTPUT_RULE_OPERATIONS
} from './prompt-preset';
export type {
  PromptPresetGenerationPurpose,
  PromptPresetListResponse,
  PromptPresetOutputRuleOperation,
  PromptPresetPayload,
  PromptPresetResponse
} from './prompt-preset';
export type {
  WorldBookEntryPayload,
  WorldBookEntryResponse,
  WorldBookEntryUpdatePayload,
  WorldBookListResponse,
  WorldBookPlacement,
  WorldBookPayload,
  WorldBookRuntimeEntry,
  WorldBookRuntimeResponse,
  WorldBookResponse,
  WorldBookUpdatePayload
} from './world-book';
export { WORLD_BOOK_FORMAT_VERSION } from './world-book';
