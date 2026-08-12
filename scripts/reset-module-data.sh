#!/usr/bin/env bash

# Tavern Lite 服务器模块级数据硬清理脚本。
# 每次只清理 --module 指定的一个模块；执行前自动停服并备份 data/ 与 uploads/。

set -Eeuo pipefail

usage() {
  cat <<'EOF'
用法：
  bash scripts/reset-module-data.sh --module <模块名> [--check] [--yes]

模块名：
  tavern-conversations  酒馆会话、消息及其生成/世界书运行记录
  characters            酒馆角色，以及依赖这些角色的全部酒馆会话
  scene-images          聊天场景生图批次、租约、图片关联、素材和生成文件
  companion-history     AI 角色聊天、生成记录、长期记忆内容和运行状态；保留 AI 角色
  companions            AI 角色及其聊天、长期记忆、运行状态和分享
  world-books           世界书、条目、版本、绑定及运行命中记录
  personas              Persona；同时解除会话、AI 角色和世界书绑定
  prompt-presets        PromptPreset；同时解除会话和 AI 角色绑定
  shares                全部分享链接
  qq-bridge             QQ 账号接入配置、好友绑定、入站事件和出站投递记录
  assets                全部素材记录和 uploads 文件；同时解除头像绑定
  settings              全部 AppSetting
  models                模型供应商、模型、模型链和候选项；同时解除运行时绑定

参数：
  --module <模块名>  必填，每次只允许选择一个模块。
  --check            只执行环境、schema、外键和目标记录数预检。
  --yes              跳过交互确认。
  -h, --help         显示帮助。

示例：
  bash scripts/reset-module-data.sh --module world-books --check
  bash scripts/reset-module-data.sh --module world-books
  bash scripts/reset-module-data.sh --module world-books --yes
EOF
}

module_name=''
check_only=0
assume_yes=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --module)
      if [[ $# -lt 2 ]]; then
        echo '错误：--module 缺少模块名。' >&2
        usage >&2
        exit 2
      fi
      module_name="$2"
      shift 2
      ;;
    --check)
      check_only=1
      shift
      ;;
    --yes)
      assume_yes=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "错误：未知参数 $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$module_name" in
  tavern-conversations|characters|scene-images|companion-history|companions|world-books|personas|prompt-presets|shares|qq-bridge|assets|settings|models)
    ;;
  '')
    echo '错误：必须通过 --module 指定要清理的模块。' >&2
    usage >&2
    exit 2
    ;;
  *)
    echo "错误：不支持的模块名：$module_name" >&2
    usage >&2
    exit 2
    ;;
esac

script_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(CDPATH= cd -- "$script_dir/.." && pwd)"
compose_file="$project_root/docker-compose.yml"
env_file="$project_root/.env"
database_file="$project_root/data/tavern-lite.db"
uploads_dir="$project_root/uploads"
backup_dir="${TAVERN_RESET_BACKUP_DIR:-$project_root/../tavern-reset-backups}"
backup_file=''
sql_file=''
service_stopped=0

cleanup_temp_file() {
  if [[ -n "$sql_file" && -f "$sql_file" ]]; then
    rm -f -- "$sql_file"
  fi
}

report_failure() {
  local exit_code=$?
  echo >&2
  echo "模块清理失败，退出码：$exit_code" >&2
  if [[ -n "$backup_file" ]]; then
    echo "操作前备份：$backup_file" >&2
  fi
  if [[ "$service_stopped" -eq 1 ]]; then
    echo '服务仍处于停止状态，请检查错误后再决定恢复备份或重新启动。' >&2
  fi
  exit "$exit_code"
}

trap cleanup_temp_file EXIT
trap report_failure ERR

if [[ "$project_root" == '/' || ! -f "$compose_file" ]]; then
  echo "错误：脚本未位于有效的 Tavern Lite 项目中：$project_root" >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  echo "错误：缺少 $env_file。" >&2
  exit 1
fi

if [[ ! -f "$database_file" ]]; then
  echo "错误：数据库不存在：$database_file" >&2
  exit 1
fi

for command_name in docker tar mktemp realpath; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "错误：服务器缺少命令 $command_name。" >&2
    exit 1
  fi
done

cd "$project_root"
docker compose version >/dev/null

echo "项目目录：$project_root"
echo "数据库：$database_file"
echo "目标模块：$module_name"

# 预检数据库必须与当前脚本认识的 schema 一致，并显示本次会受影响的主记录数。
docker compose run --rm -T --no-deps --entrypoint node server -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const moduleName = process.argv[1];
const expectedTables = [
  "AppSetting",
  "Asset",
  "Character",
  "Companion",
  "CompanionGenerationAttempt",
  "CompanionGenerationRequest",
  "CompanionIncludedWorldBookTrace",
  "CompanionMemory",
  "CompanionMemoryRevision",
  "CompanionMessage",
  "CompanionMessageGenerationTrace",
  "CompanionMessagePromptSectionTrace",
  "CompanionRuntimeState",
  "CompanionTurn",
  "CompanionWorldBookActivationEvent",
  "CompanionWorldBookActivationState",
  "Conversation",
  "ConversationGenerationAttempt",
  "ConversationGenerationRequest",
  "ConversationIncludedWorldBookTrace",
  "ConversationMessageGenerationTrace",
  "ConversationMessagePromptSectionTrace",
  "ConversationTurn",
  "ConversationWorldBookActivationEvent",
  "ConversationWorldBookActivationState",
  "ImageAsset",
  "ImageGenerationBatch",
  "ImageGenerationLease",
  "Message",
  "MessageImageLink",
  "ModelFallbackCandidate",
  "ModelFallbackGroup",
  "ModelProvider",
  "PromptPreset",
  "ProviderModel",
  "QqAccount",
  "QqChatBinding",
  "QqDelivery",
  "QqInboundEvent",
  "ShareLink",
  "User",
  "UserPersona",
  "WorldBook",
  "WorldBookCharacter",
  "WorldBookCompanion",
  "WorldBookConversation",
  "WorldBookEntry",
  "WorldBookEntryRevision",
  "WorldBookPersona"
].sort();

(async () => {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type = '\''table'\'' AND name NOT LIKE '\''sqlite_%'\'' AND name <> '\''_prisma_migrations'\'' ORDER BY name"
  );
  const actualTables = rows.map((row) => row.name).sort();
  const missing = expectedTables.filter((name) => !actualTables.includes(name));
  const unexpected = actualTables.filter((name) => !expectedTables.includes(name));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `数据库表与脚本支持的 schema 不一致。缺少：${JSON.stringify(missing)}；未识别：${JSON.stringify(unexpected)}`
    );
  }

  const foreignKeyErrors = await prisma.$queryRawUnsafe("PRAGMA foreign_key_check");
  if (!Array.isArray(foreignKeyErrors)) {
    throw new Error("无法读取数据库外键检查结果。");
  }
  if (foreignKeyErrors.length > 0) {
    const printableForeignKeyErrors = foreignKeyErrors.map((item) =>
      Object.fromEntries(
        Object.entries(item).map(([key, value]) => [
          key,
          typeof value === "bigint" ? value.toString() : value
        ])
      )
    );
    throw new Error(
      `清理前数据库存在外键异常，请先确认具体坏表：${JSON.stringify(printableForeignKeyErrors)}`
    );
  }

  const counters = {
    "tavern-conversations": async () => ({ Conversation: await prisma.conversation.count() }),
    characters: async () => ({
      Character: await prisma.character.count(),
      dependentConversation: await prisma.conversation.count()
    }),
    "scene-images": async () => ({
      ImageGenerationBatch: await prisma.imageGenerationBatch.count(),
      ImageAsset: await prisma.imageAsset.count()
    }),
    "companion-history": async () => ({
      CompanionMessage: await prisma.companionMessage.count(),
      CompanionMemoryRevision: await prisma.companionMemoryRevision.count()
    }),
    companions: async () => ({ Companion: await prisma.companion.count() }),
    "world-books": async () => ({ WorldBook: await prisma.worldBook.count() }),
    personas: async () => ({ UserPersona: await prisma.userPersona.count() }),
    "prompt-presets": async () => ({ PromptPreset: await prisma.promptPreset.count() }),
    shares: async () => ({ ShareLink: await prisma.shareLink.count() }),
    "qq-bridge": async () => ({
      QqAccount: await prisma.qqAccount.count(),
      QqChatBinding: await prisma.qqChatBinding.count(),
      QqInboundEvent: await prisma.qqInboundEvent.count(),
      QqDelivery: await prisma.qqDelivery.count()
    }),
    assets: async () => ({ Asset: await prisma.asset.count() }),
    settings: async () => ({ AppSetting: await prisma.appSetting.count() }),
    models: async () => ({
      ModelProvider: await prisma.modelProvider.count(),
      ProviderModel: await prisma.providerModel.count(),
      ModelFallbackGroup: await prisma.modelFallbackGroup.count(),
      ModelFallbackCandidate: await prisma.modelFallbackCandidate.count()
    })
  };
  const counter = counters[moduleName];
  if (!counter) {
    throw new Error(`不支持的模块名：${moduleName}`);
  }
  console.log(`预检通过，目标记录数：${JSON.stringify(await counter())}`);
})()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
' "$module_name"

if [[ "$check_only" -eq 1 ]]; then
  echo '检查完成：未停止服务，未修改数据库或 uploads。'
  exit 0
fi

if [[ "$assume_yes" -ne 1 ]]; then
  echo
  echo "即将硬删除模块数据：$module_name"
  echo '执行前会停止服务并备份 data/ 与 uploads/。'
  if [[ "$module_name" == 'characters' ]]; then
    echo '注意：角色是酒馆会话的必需父级，因此其全部酒馆会话也会删除。'
  elif [[ "$module_name" == 'scene-images' ]]; then
    echo '注意：保留酒馆会话和消息，但删除全部场景生图记录、素材和生成文件。'
  elif [[ "$module_name" == 'companion-history' ]]; then
    echo '注意：保留 AI 角色和长期记忆设置，但删除消息、总结版本、运行状态与世界书运行记录。'
  elif [[ "$module_name" == 'assets' ]]; then
    echo '注意：将解除全部角色头像绑定，并清空 uploads。'
  elif [[ "$module_name" == 'models' ]]; then
    echo '注意：将解除会话、AI 角色和长期记忆的模型链绑定，并删除依赖模型链的场景生图。'
  fi
  echo
  read -r -p "请输入 RESET MODULE $module_name 继续：" confirmation
  if [[ "$confirmation" != "RESET MODULE $module_name" ]]; then
    echo '已取消，未修改任何数据。'
    exit 0
  fi
fi

echo '正在停止 Tavern Lite 服务……'
docker compose down
service_stopped=1

mkdir -p -- "$backup_dir" "$project_root/data" "$uploads_dir"
timestamp="$(date +%Y%m%d-%H%M%S)"
backup_file="$backup_dir/tavern-before-reset-module-${module_name}-${timestamp}.tar.gz"

echo "正在创建操作前备份：$backup_file"
tar -czf "$backup_file" -C "$project_root" data uploads
if [[ ! -s "$backup_file" ]]; then
  echo '错误：备份文件未成功生成。' >&2
  exit 1
fi

sql_file="$(mktemp)"
cat >"$sql_file" <<'SQL'
PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;

CREATE TEMP TABLE "__ResetUserGuard" (
  "rowCount" INTEGER NOT NULL
);
INSERT INTO "__ResetUserGuard" SELECT COUNT(*) FROM "User";
SQL

append_tavern_conversation_cleanup() {
  cat >>"$sql_file" <<'SQL'
DELETE FROM "ConversationMessagePromptSectionTrace";
DELETE FROM "ConversationIncludedWorldBookTrace";
DELETE FROM "ConversationMessageGenerationTrace";
DELETE FROM "ConversationGenerationAttempt";
DELETE FROM "ConversationGenerationRequest";
DELETE FROM "ConversationWorldBookActivationState";
DELETE FROM "ConversationWorldBookActivationEvent";
DELETE FROM "Message";
DELETE FROM "ConversationTurn";
DELETE FROM "ShareLink" WHERE "conversationId" IS NOT NULL;
DELETE FROM "QqDelivery" WHERE "bindingId" IN (
  SELECT "id" FROM "QqChatBinding" WHERE "conversationId" IS NOT NULL
);
DELETE FROM "QqInboundEvent" WHERE "bindingId" IN (
  SELECT "id" FROM "QqChatBinding" WHERE "conversationId" IS NOT NULL
);
DELETE FROM "QqChatBinding" WHERE "conversationId" IS NOT NULL;
DELETE FROM "WorldBookConversation";
DELETE FROM "Conversation";
SQL
}

append_scene_image_cleanup() {
  cat >>"$sql_file" <<'SQL'
DELETE FROM "MessageImageLink";
DELETE FROM "ImageGenerationLease";
DELETE FROM "ImageAsset";
DELETE FROM "ImageGenerationBatch";
DELETE FROM "Asset" WHERE "kind" = 'generated_image';
SQL
}

append_companion_history_cleanup() {
  cat >>"$sql_file" <<'SQL'
DELETE FROM "CompanionMessagePromptSectionTrace";
DELETE FROM "CompanionIncludedWorldBookTrace";
DELETE FROM "CompanionMessageGenerationTrace";
DELETE FROM "CompanionGenerationAttempt";
DELETE FROM "CompanionGenerationRequest";
DELETE FROM "CompanionWorldBookActivationState";
DELETE FROM "CompanionWorldBookActivationEvent";
DELETE FROM "CompanionMemoryRevision";
DELETE FROM "CompanionMessage";
DELETE FROM "CompanionTurn";
DELETE FROM "CompanionRuntimeState";
UPDATE "CompanionMemory"
SET "status" = 'ready',
    "activeRevisionId" = NULL,
    "workingRevisionId" = NULL,
    "lastSummarizedMessageId" = NULL,
    "rebuildFromMessageId" = NULL,
    "historyFloorMessageId" = NULL,
    "lastErrorCode" = NULL,
    "retryCount" = 0,
    "nextRetryAt" = NULL;
SQL
}

case "$module_name" in
  tavern-conversations)
    append_scene_image_cleanup
    append_tavern_conversation_cleanup
    ;;
  characters)
    append_scene_image_cleanup
    append_tavern_conversation_cleanup
    cat >>"$sql_file" <<'SQL'
DELETE FROM "WorldBookCharacter";
DELETE FROM "Character";
SQL
    ;;
  scene-images)
    append_scene_image_cleanup
    ;;
  companion-history)
    append_companion_history_cleanup
    ;;
  companions)
    append_companion_history_cleanup
    cat >>"$sql_file" <<'SQL'
DELETE FROM "ShareLink" WHERE "companionId" IS NOT NULL;
DELETE FROM "QqDelivery" WHERE "bindingId" IN (
  SELECT "id" FROM "QqChatBinding" WHERE "companionId" IS NOT NULL
);
DELETE FROM "QqInboundEvent" WHERE "bindingId" IN (
  SELECT "id" FROM "QqChatBinding" WHERE "companionId" IS NOT NULL
);
DELETE FROM "QqChatBinding" WHERE "companionId" IS NOT NULL;
DELETE FROM "WorldBookCompanion";
DELETE FROM "CompanionMemory";
DELETE FROM "Companion";
SQL
    ;;
  world-books)
    cat >>"$sql_file" <<'SQL'
DELETE FROM "ConversationIncludedWorldBookTrace";
DELETE FROM "CompanionIncludedWorldBookTrace";
DELETE FROM "ConversationWorldBookActivationState";
DELETE FROM "CompanionWorldBookActivationState";
DELETE FROM "ConversationWorldBookActivationEvent";
DELETE FROM "CompanionWorldBookActivationEvent";
DELETE FROM "WorldBookCharacter";
DELETE FROM "WorldBookPersona";
DELETE FROM "WorldBookConversation";
DELETE FROM "WorldBookCompanion";
DELETE FROM "WorldBookEntryRevision";
DELETE FROM "WorldBookEntry";
DELETE FROM "WorldBook";
SQL
    ;;
  personas)
    cat >>"$sql_file" <<'SQL'
UPDATE "Conversation" SET "personaId" = NULL;
UPDATE "Companion" SET "personaId" = NULL;
DELETE FROM "WorldBookPersona";
DELETE FROM "UserPersona";
SQL
    ;;
  prompt-presets)
    cat >>"$sql_file" <<'SQL'
UPDATE "Conversation" SET "promptPresetId" = NULL;
UPDATE "Companion" SET "promptPresetId" = NULL;
DELETE FROM "PromptPreset";
SQL
    ;;
  shares)
    cat >>"$sql_file" <<'SQL'
DELETE FROM "ShareLink";
SQL
    ;;
  qq-bridge)
    cat >>"$sql_file" <<'SQL'
DELETE FROM "QqDelivery";
DELETE FROM "QqInboundEvent";
DELETE FROM "QqChatBinding";
DELETE FROM "QqAccount";
SQL
    ;;
  assets)
    append_scene_image_cleanup
    cat >>"$sql_file" <<'SQL'
UPDATE "Character" SET "avatarAssetId" = NULL;
UPDATE "Companion" SET "avatarAssetId" = NULL;
DELETE FROM "Asset";
SQL
    ;;
  settings)
    cat >>"$sql_file" <<'SQL'
DELETE FROM "AppSetting";
SQL
    ;;
  models)
    append_scene_image_cleanup
    cat >>"$sql_file" <<'SQL'
UPDATE "Conversation" SET "modelFallbackGroupId" = NULL;
UPDATE "Conversation" SET "imageModelFallbackGroupId" = NULL;
UPDATE "Companion" SET "modelFallbackGroupId" = NULL;
UPDATE "CompanionMemory" SET "memoryModelFallbackGroupId" = NULL;
DELETE FROM "ModelFallbackCandidate";
DELETE FROM "ModelFallbackGroup";
DELETE FROM "ProviderModel";
DELETE FROM "ModelProvider";
SQL
    ;;
esac

cat >>"$sql_file" <<'SQL'
CREATE TEMP TABLE "__ResetUserCountGuard" (
  "ok" INTEGER NOT NULL CHECK ("ok" = 1)
);
INSERT INTO "__ResetUserCountGuard"
SELECT CASE
  WHEN (SELECT "rowCount" FROM "__ResetUserGuard") = (SELECT COUNT(*) FROM "User")
  THEN 1 ELSE 0
END;

COMMIT;
PRAGMA foreign_keys = ON;
SQL

echo "正在清理模块：$module_name"
docker compose run --rm -T --no-deps \
  --entrypoint pnpm \
  server exec prisma db execute \
  --schema prisma/schema.prisma \
  --stdin <"$sql_file"

echo '正在校验清理结果和数据库外键……'
docker compose run --rm -T --no-deps --entrypoint node server -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const moduleName = process.argv[1];

(async () => {
  const zeroModels = {
    "tavern-conversations": [
      prisma.conversation,
      prisma.message,
      prisma.conversationTurn,
      prisma.conversationGenerationRequest,
      prisma.conversationGenerationAttempt,
      prisma.conversationMessageGenerationTrace,
      prisma.conversationMessagePromptSectionTrace,
      prisma.conversationWorldBookActivationState,
      prisma.conversationWorldBookActivationEvent,
      prisma.conversationIncludedWorldBookTrace,
      prisma.worldBookConversation
    ],
    characters: [prisma.character, prisma.worldBookCharacter],
    "scene-images": [
      prisma.messageImageLink,
      prisma.imageGenerationLease,
      prisma.imageAsset,
      prisma.imageGenerationBatch
    ],
    "companion-history": [
      prisma.companionMessage,
      prisma.companionTurn,
      prisma.companionGenerationRequest,
      prisma.companionGenerationAttempt,
      prisma.companionMessageGenerationTrace,
      prisma.companionMessagePromptSectionTrace,
      prisma.companionMemoryRevision,
      prisma.companionRuntimeState,
      prisma.companionWorldBookActivationState,
      prisma.companionWorldBookActivationEvent,
      prisma.companionIncludedWorldBookTrace
    ],
    companions: [prisma.companion, prisma.companionMemory, prisma.worldBookCompanion],
    "world-books": [
      prisma.worldBook,
      prisma.worldBookEntry,
      prisma.worldBookEntryRevision,
      prisma.worldBookCharacter,
      prisma.worldBookPersona,
      prisma.worldBookConversation,
      prisma.worldBookCompanion,
      prisma.conversationWorldBookActivationState,
      prisma.companionWorldBookActivationState,
      prisma.conversationWorldBookActivationEvent,
      prisma.companionWorldBookActivationEvent,
      prisma.conversationIncludedWorldBookTrace,
      prisma.companionIncludedWorldBookTrace
    ],
    personas: [prisma.userPersona, prisma.worldBookPersona],
    "prompt-presets": [prisma.promptPreset],
    shares: [prisma.shareLink],
    "qq-bridge": [
      prisma.qqDelivery,
      prisma.qqInboundEvent,
      prisma.qqChatBinding,
      prisma.qqAccount
    ],
    assets: [prisma.asset],
    settings: [prisma.appSetting],
    models: [
      prisma.modelFallbackCandidate,
      prisma.modelFallbackGroup,
      prisma.providerModel,
      prisma.modelProvider
    ]
  };

  const models = [...(zeroModels[moduleName] || [])];
  if (moduleName === "characters") {
    models.push(...zeroModels["tavern-conversations"]);
  }
  if (["tavern-conversations", "characters", "assets", "models"].includes(moduleName)) {
    models.push(...zeroModels["scene-images"]);
  }
  if (moduleName === "companions") {
    models.push(...zeroModels["companion-history"]);
  }
  const counts = await Promise.all(models.map((model) => model.count()));
  if (counts.some((count) => count !== 0)) {
    throw new Error(`模块仍有数据未清空：${JSON.stringify(counts)}`);
  }

  if (moduleName === "companion-history") {
    const dirtyMemory = await prisma.companionMemory.count({
      where: {
        OR: [
          { status: { not: "ready" } },
          { activeRevisionId: { not: null } },
          { workingRevisionId: { not: null } },
          { lastSummarizedMessageId: { not: null } },
          { rebuildFromMessageId: { not: null } },
          { historyFloorMessageId: { not: null } },
          { lastErrorCode: { not: null } },
          { retryCount: { not: 0 } },
          { nextRetryAt: { not: null } }
        ]
      }
    });
    if (dirtyMemory !== 0) {
      throw new Error("AI 角色长期记忆运行状态未完全复位。");
    }
  }

  if (moduleName === "personas") {
    const bound = (await prisma.conversation.count({ where: { personaId: { not: null } } }))
      + (await prisma.companion.count({ where: { personaId: { not: null } } }));
    if (bound !== 0) throw new Error("仍有 Persona 绑定未解除。");
  }
  if (moduleName === "prompt-presets") {
    const bound = (await prisma.conversation.count({ where: { promptPresetId: { not: null } } }))
      + (await prisma.companion.count({ where: { promptPresetId: { not: null } } }));
    if (bound !== 0) throw new Error("仍有 PromptPreset 绑定未解除。");
  }
  if (moduleName === "assets") {
    const bound = (await prisma.character.count({ where: { avatarAssetId: { not: null } } }))
      + (await prisma.companion.count({ where: { avatarAssetId: { not: null } } }));
    if (bound !== 0) throw new Error("仍有头像素材绑定未解除。");
  }
  if (
    ["scene-images", "tavern-conversations", "characters", "assets", "models"].includes(moduleName)
  ) {
    const generatedAssets = await prisma.asset.count({ where: { kind: "generated_image" } });
    if (generatedAssets !== 0) throw new Error("仍有聊天场景生图素材记录未清空。");
  }
  if (moduleName === "models") {
    const bound = (await prisma.conversation.count({ where: { modelFallbackGroupId: { not: null } } }))
      + (await prisma.conversation.count({
        where: { imageModelFallbackGroupId: { not: null } }
      }))
      + (await prisma.companion.count({ where: { modelFallbackGroupId: { not: null } } }))
      + (await prisma.companionMemory.count({
        where: { memoryModelFallbackGroupId: { not: null } }
      }));
    if (bound !== 0) throw new Error("仍有模型链绑定未解除。");
  }

  const foreignKeyErrors = await prisma.$queryRawUnsafe("PRAGMA foreign_key_check");
  if (!Array.isArray(foreignKeyErrors) || foreignKeyErrors.length > 0) {
    throw new Error(`数据库存在外键异常：${JSON.stringify(foreignKeyErrors)}`);
  }
  console.log(`模块清理校验通过：${moduleName}`);
})()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
' "$module_name"

if [[ "$module_name" == 'assets' ]]; then
  resolved_uploads="$(realpath -m -- "$uploads_dir")"
  expected_uploads="$(realpath -m -- "$project_root/uploads")"
  if [[ "$resolved_uploads" != "$expected_uploads" || "$resolved_uploads" == '/' ]]; then
    echo "错误：uploads 路径校验失败：$resolved_uploads" >&2
    exit 1
  fi
  echo "正在清空 uploads：$resolved_uploads"
  rm -rf -- "$resolved_uploads"
  mkdir -p -- "$resolved_uploads"
elif [[ "$module_name" == 'scene-images' || "$module_name" == 'tavern-conversations' || "$module_name" == 'characters' || "$module_name" == 'models' ]]; then
  generated_images_dir="$uploads_dir/generated-images"
  resolved_generated_images="$(realpath -m -- "$generated_images_dir")"
  expected_generated_images="$(realpath -m -- "$uploads_dir/generated-images")"
  if [[ "$resolved_generated_images" != "$expected_generated_images" || "$resolved_generated_images" == '/' ]]; then
    echo "错误：generated-images 路径校验失败：$resolved_generated_images" >&2
    exit 1
  fi
  echo "正在清空聊天场景生图文件：$resolved_generated_images"
  rm -rf -- "$resolved_generated_images"
  mkdir -p -- "$resolved_generated_images"
fi

echo '正在启动 Tavern Lite 服务……'
docker compose up -d
service_stopped=0
docker compose ps

echo
echo "模块清理完成：$module_name"
echo "操作前备份：$backup_file"
echo '未执行 db:seed。'
