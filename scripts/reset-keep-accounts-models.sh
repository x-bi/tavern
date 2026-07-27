#!/usr/bin/env bash

# Tavern Lite 服务器选择性硬清理脚本。
# 保留账号、模型配置和 Prisma 迁移记录，硬删除其余数据库数据与 uploads 文件。
# bash scripts/reset-keep-accounts-models.sh --yes

set -Eeuo pipefail

usage() {
  cat <<'EOF'
用法：
  bash scripts/reset-keep-accounts-models.sh [--check] [--yes]

参数：
  --check     只执行环境、数据库表和外键预检，不停止服务、不修改数据。
  --yes       跳过交互确认，适合已人工确认后的非交互执行。
  -h, --help  显示帮助。

保留：
  User
  ModelProvider
  ProviderModel
  ModelFallbackGroup
  ModelFallbackCandidate
  _prisma_migrations

示例：
  bash scripts/reset-keep-accounts-models.sh --check
  bash scripts/reset-keep-accounts-models.sh
  bash scripts/reset-keep-accounts-models.sh --yes
EOF
}

check_only=0
assume_yes=0

while [[ $# -gt 0 ]]; do
  case "$1" in
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
  echo "清理失败，退出码：$exit_code" >&2
  if [[ -n "$backup_file" ]]; then
    echo "操作前备份：$backup_file" >&2
  fi
  if [[ "$service_stopped" -eq 1 ]]; then
    echo '服务仍处于停止状态，请检查上方错误后再决定恢复备份或重新启动。' >&2
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
echo '保留范围：全部账号、模型供应商、模型、模型链、模型链候选项、Prisma 迁移记录'

# 表集合必须与脚本编写时的 schema 完全一致。新增表未纳入清理范围时直接中止，避免静默漏删。
docker compose run --rm -T --no-deps --entrypoint node server -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
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
  "Message",
  "ModelFallbackCandidate",
  "ModelFallbackGroup",
  "ModelProvider",
  "PromptPreset",
  "ProviderModel",
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
  const printableForeignKeyErrors = foreignKeyErrors.map((item) =>
    Object.fromEntries(
      Object.entries(item).map(([key, value]) => [
        key,
        typeof value === "bigint" ? value.toString() : value
      ])
    )
  );
  const preservedTables = new Set([
    "User",
    "ModelProvider",
    "ProviderModel",
    "ModelFallbackGroup",
    "ModelFallbackCandidate"
  ]);
  const preservedTableErrors = printableForeignKeyErrors.filter((item) =>
    preservedTables.has(String(item.table))
  );
  if (preservedTableErrors.length > 0) {
    throw new Error(
      `要保留的账号或模型表存在外键异常，拒绝清理：${JSON.stringify(preservedTableErrors)}`
    );
  }
  if (printableForeignKeyErrors.length > 0) {
    console.warn(
      `警告：发现 ${printableForeignKeyErrors.length} 条外键异常，但都位于本次将清空的业务表中：${JSON.stringify(printableForeignKeyErrors)}`
    );
    console.warn("正式清理后脚本会再次执行外键检查。");
  }

  const counts = {
    User: await prisma.user.count(),
    ModelProvider: await prisma.modelProvider.count(),
    ProviderModel: await prisma.providerModel.count(),
    ModelFallbackGroup: await prisma.modelFallbackGroup.count(),
    ModelFallbackCandidate: await prisma.modelFallbackCandidate.count()
  };
  if (counts.User < 1) {
    throw new Error("数据库中没有账号，拒绝执行“保留账号”清理。");
  }
  console.log(`预检通过，保留表当前记录数：${JSON.stringify(counts)}`);
})()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
'

if [[ "$check_only" -eq 1 ]]; then
  echo '检查完成：未停止服务，未修改数据库或 uploads。'
  exit 0
fi

if [[ "$assume_yes" -ne 1 ]]; then
  echo
  echo '即将执行硬删除：'
  echo '  - 保留全部账号信息'
  echo '  - 保留全部模型供应商、模型、模型链和候选项'
  echo '  - 删除角色、会话、消息、AI 角色、长期记忆、世界书、预设、Persona、分享、素材记录和应用设置'
  echo '  - 备份后清空 uploads 目录'
  echo '  - 保留 _prisma_migrations'
  echo
  read -r -p '请输入 RESET KEEP ACCOUNTS AND MODELS 继续：' confirmation
  if [[ "$confirmation" != 'RESET KEEP ACCOUNTS AND MODELS' ]]; then
    echo '已取消，未修改任何数据。'
    exit 0
  fi
fi

echo '正在停止 Tavern Lite 服务……'
docker compose down
service_stopped=1

mkdir -p -- "$backup_dir" "$project_root/data" "$uploads_dir"
timestamp="$(date +%Y%m%d-%H%M%S)"
backup_file="$backup_dir/tavern-before-reset-keep-accounts-models-${timestamp}.tar.gz"

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

CREATE TEMP TABLE "__ResetPreservedCounts" (
  "tableName" TEXT PRIMARY KEY,
  "rowCount" INTEGER NOT NULL
);

INSERT INTO "__ResetPreservedCounts" VALUES
  ('User', (SELECT COUNT(*) FROM "User")),
  ('ModelProvider', (SELECT COUNT(*) FROM "ModelProvider")),
  ('ProviderModel', (SELECT COUNT(*) FROM "ProviderModel")),
  ('ModelFallbackGroup', (SELECT COUNT(*) FROM "ModelFallbackGroup")),
  ('ModelFallbackCandidate', (SELECT COUNT(*) FROM "ModelFallbackCandidate"));

DELETE FROM "AppSetting";
DELETE FROM "Asset";
DELETE FROM "Character";
DELETE FROM "Companion";
DELETE FROM "CompanionGenerationAttempt";
DELETE FROM "CompanionGenerationRequest";
DELETE FROM "CompanionIncludedWorldBookTrace";
DELETE FROM "CompanionMemory";
DELETE FROM "CompanionMemoryRevision";
DELETE FROM "CompanionMessage";
DELETE FROM "CompanionMessageGenerationTrace";
DELETE FROM "CompanionMessagePromptSectionTrace";
DELETE FROM "CompanionRuntimeState";
DELETE FROM "CompanionTurn";
DELETE FROM "CompanionWorldBookActivationEvent";
DELETE FROM "CompanionWorldBookActivationState";
DELETE FROM "Conversation";
DELETE FROM "ConversationGenerationAttempt";
DELETE FROM "ConversationGenerationRequest";
DELETE FROM "ConversationIncludedWorldBookTrace";
DELETE FROM "ConversationMessageGenerationTrace";
DELETE FROM "ConversationMessagePromptSectionTrace";
DELETE FROM "ConversationTurn";
DELETE FROM "ConversationWorldBookActivationEvent";
DELETE FROM "ConversationWorldBookActivationState";
DELETE FROM "Message";
DELETE FROM "PromptPreset";
DELETE FROM "ShareLink";
DELETE FROM "UserPersona";
DELETE FROM "WorldBook";
DELETE FROM "WorldBookCharacter";
DELETE FROM "WorldBookCompanion";
DELETE FROM "WorldBookConversation";
DELETE FROM "WorldBookEntry";
DELETE FROM "WorldBookEntryRevision";
DELETE FROM "WorldBookPersona";

CREATE TEMP TABLE "__ResetPreservedGuard" (
  "ok" INTEGER NOT NULL CHECK ("ok" = 1)
);

INSERT INTO "__ResetPreservedGuard"
SELECT CASE WHEN
  (SELECT "rowCount" FROM "__ResetPreservedCounts" WHERE "tableName" = 'User') = (SELECT COUNT(*) FROM "User")
  AND (SELECT "rowCount" FROM "__ResetPreservedCounts" WHERE "tableName" = 'ModelProvider') = (SELECT COUNT(*) FROM "ModelProvider")
  AND (SELECT "rowCount" FROM "__ResetPreservedCounts" WHERE "tableName" = 'ProviderModel') = (SELECT COUNT(*) FROM "ProviderModel")
  AND (SELECT "rowCount" FROM "__ResetPreservedCounts" WHERE "tableName" = 'ModelFallbackGroup') = (SELECT COUNT(*) FROM "ModelFallbackGroup")
  AND (SELECT "rowCount" FROM "__ResetPreservedCounts" WHERE "tableName" = 'ModelFallbackCandidate') = (SELECT COUNT(*) FROM "ModelFallbackCandidate")
THEN 1 ELSE 0 END;

COMMIT;

PRAGMA foreign_keys = ON;
SQL

echo '正在硬删除账号和模型之外的全部数据库数据……'
docker compose run --rm -T --no-deps \
  --entrypoint pnpm \
  server exec prisma db execute \
  --schema prisma/schema.prisma \
  --stdin <"$sql_file"

echo '正在校验数据库清理结果……'
docker compose run --rm -T --no-deps --entrypoint node server -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const clearedModels = {
    AppSetting: prisma.appSetting,
    Asset: prisma.asset,
    Character: prisma.character,
    Companion: prisma.companion,
    CompanionGenerationAttempt: prisma.companionGenerationAttempt,
    CompanionGenerationRequest: prisma.companionGenerationRequest,
    CompanionIncludedWorldBookTrace: prisma.companionIncludedWorldBookTrace,
    CompanionMemory: prisma.companionMemory,
    CompanionMemoryRevision: prisma.companionMemoryRevision,
    CompanionMessage: prisma.companionMessage,
    CompanionMessageGenerationTrace: prisma.companionMessageGenerationTrace,
    CompanionMessagePromptSectionTrace: prisma.companionMessagePromptSectionTrace,
    CompanionRuntimeState: prisma.companionRuntimeState,
    CompanionTurn: prisma.companionTurn,
    CompanionWorldBookActivationEvent: prisma.companionWorldBookActivationEvent,
    CompanionWorldBookActivationState: prisma.companionWorldBookActivationState,
    Conversation: prisma.conversation,
    ConversationGenerationAttempt: prisma.conversationGenerationAttempt,
    ConversationGenerationRequest: prisma.conversationGenerationRequest,
    ConversationIncludedWorldBookTrace: prisma.conversationIncludedWorldBookTrace,
    ConversationMessageGenerationTrace: prisma.conversationMessageGenerationTrace,
    ConversationMessagePromptSectionTrace: prisma.conversationMessagePromptSectionTrace,
    ConversationTurn: prisma.conversationTurn,
    ConversationWorldBookActivationEvent: prisma.conversationWorldBookActivationEvent,
    ConversationWorldBookActivationState: prisma.conversationWorldBookActivationState,
    Message: prisma.message,
    PromptPreset: prisma.promptPreset,
    ShareLink: prisma.shareLink,
    UserPersona: prisma.userPersona,
    WorldBook: prisma.worldBook,
    WorldBookCharacter: prisma.worldBookCharacter,
    WorldBookCompanion: prisma.worldBookCompanion,
    WorldBookConversation: prisma.worldBookConversation,
    WorldBookEntry: prisma.worldBookEntry,
    WorldBookEntryRevision: prisma.worldBookEntryRevision,
    WorldBookPersona: prisma.worldBookPersona
  };
  const counts = Object.fromEntries(
    await Promise.all(
      Object.entries(clearedModels).map(async ([name, model]) => [name, await model.count()])
    )
  );
  const remaining = Object.entries(counts).filter(([, count]) => count !== 0);
  if (remaining.length > 0) {
    throw new Error(`仍有应清空的表存在数据：${JSON.stringify(remaining)}`);
  }

  const preservedCounts = {
    User: await prisma.user.count(),
    ModelProvider: await prisma.modelProvider.count(),
    ProviderModel: await prisma.providerModel.count(),
    ModelFallbackGroup: await prisma.modelFallbackGroup.count(),
    ModelFallbackCandidate: await prisma.modelFallbackCandidate.count()
  };
  if (preservedCounts.User < 1) {
    throw new Error("账号表为空，不符合保留要求。");
  }

  const foreignKeyErrors = await prisma.$queryRawUnsafe("PRAGMA foreign_key_check");
  if (!Array.isArray(foreignKeyErrors) || foreignKeyErrors.length > 0) {
    throw new Error(`数据库存在外键异常：${JSON.stringify(foreignKeyErrors)}`);
  }
  console.log(`数据库校验通过，保留表记录数：${JSON.stringify(preservedCounts)}`);
})()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
'

resolved_uploads="$(realpath -m -- "$uploads_dir")"
expected_uploads="$(realpath -m -- "$project_root/uploads")"
if [[ "$resolved_uploads" != "$expected_uploads" || "$resolved_uploads" == '/' ]]; then
  echo "错误：uploads 路径校验失败：$resolved_uploads" >&2
  exit 1
fi

echo "正在清空 uploads：$resolved_uploads"
rm -rf -- "$resolved_uploads"
mkdir -p -- "$resolved_uploads"

echo '正在启动 Tavern Lite 服务……'
docker compose up -d
service_stopped=0
docker compose ps

echo
echo '选择性硬清理完成。'
echo '已保留：全部账号和全部模型配置。'
echo "操作前备份：$backup_file"
echo '未执行 db:seed。'
