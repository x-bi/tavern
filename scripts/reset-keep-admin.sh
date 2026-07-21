#!/usr/bin/env bash

# Tavern Lite 服务器硬清理脚本。
# 保留一个明确指定的管理员账号和 Prisma 迁移记录，硬删除其余数据库数据与 uploads 文件。
# bash scripts/reset-keep-admin.sh --admin root --yes

set -Eeuo pipefail

usage() {
  cat <<'EOF'
用法：
  bash scripts/reset-keep-admin.sh --admin <管理员用户名> [--check] [--yes]

参数：
  --admin <用户名>  必填，只保留该管理员账号。
  --check           只执行环境和管理员校验，不停止服务、不修改数据。
  --yes             跳过交互确认，适合已人工确认后的非交互执行。
  -h, --help        显示帮助。

示例：
  bash scripts/reset-keep-admin.sh --admin root --check
  bash scripts/reset-keep-admin.sh --admin root
  bash scripts/reset-keep-admin.sh --admin root --yes
EOF
}

admin_username=''
check_only=0
assume_yes=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --admin)
      if [[ $# -lt 2 ]]; then
        echo '错误：--admin 缺少管理员用户名。' >&2
        usage >&2
        exit 2
      fi
      admin_username="$2"
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

if [[ -z "$admin_username" ]]; then
  echo '错误：必须通过 --admin 指定唯一保留的管理员用户名。' >&2
  usage >&2
  exit 2
fi

if [[ ! "$admin_username" =~ ^[a-zA-Z0-9_.-]{3,64}$ ]]; then
  echo '错误：管理员用户名格式不合法。' >&2
  exit 2
fi

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
echo "唯一保留管理员：$admin_username"

# 登录会同步 AUTH_PRESET_USERS_JSON；脚本要求环境中只保留同一个管理员，避免成员被重新创建。
docker compose run --rm -T --no-deps --entrypoint node server -e '
const expected = process.argv[1];
let users;
try {
  users = JSON.parse(process.env.AUTH_PRESET_USERS_JSON || "[]");
} catch {
  console.error("错误：AUTH_PRESET_USERS_JSON 不是合法 JSON。");
  process.exit(1);
}
if (
  !Array.isArray(users) ||
  users.length !== 1 ||
  users[0]?.username !== expected ||
  users[0]?.role !== "admin"
) {
  console.error("错误：.env 的 AUTH_PRESET_USERS_JSON 必须只包含 --admin 指定的一个管理员账号。");
  process.exit(1);
}
' "$admin_username"

# 清理前必须确认数据库中存在且仅能命中一个同名管理员。
docker compose run --rm -T --no-deps --entrypoint node server -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const expected = process.argv[1];
(async () => {
  const user = await prisma.user.findUnique({
    where: { username: expected },
    select: { username: true, role: true }
  });
  if (!user || user.role !== "admin") {
    throw new Error("数据库中不存在 --admin 指定的管理员账号。");
  }
  console.log(`管理员预检通过：${user.username}`);
})()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
' "$admin_username"

if [[ "$check_only" -eq 1 ]]; then
  echo '检查完成：未停止服务，未修改数据库或 uploads。'
  exit 0
fi

if [[ "$assume_yes" -ne 1 ]]; then
  echo
  echo '即将执行硬删除：'
  echo "  - 仅保留管理员账号：$admin_username"
  echo '  - 删除其他全部账号和全部业务数据'
  echo '  - 删除全部模型配置、角色、会话、消息、AI 记忆、世界书、预设、Persona、分享和设置'
  echo '  - 清空 uploads 目录'
  echo '  - 保留 _prisma_migrations'
  echo
  read -r -p "请输入 RESET $admin_username 继续：" confirmation
  if [[ "$confirmation" != "RESET $admin_username" ]]; then
    echo '已取消，未修改任何数据。'
    exit 0
  fi
fi

echo '正在停止 Tavern Lite 服务……'
docker compose down
service_stopped=1

mkdir -p -- "$backup_dir" "$project_root/data" "$uploads_dir"
timestamp="$(date +%Y%m%d-%H%M%S)"
backup_file="$backup_dir/tavern-before-hard-reset-keep-${admin_username}-${timestamp}.tar.gz"

echo "正在创建操作前备份：$backup_file"
tar -czf "$backup_file" -C "$project_root" data uploads

if [[ ! -s "$backup_file" ]]; then
  echo '错误：备份文件未成功生成。' >&2
  exit 1
fi

sql_file="$(mktemp)"

cat >"$sql_file" <<SQL
PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

CREATE TEMP TABLE "__ResetAdminGuard" (
  "id" TEXT PRIMARY KEY,
  "ok" INTEGER NOT NULL CHECK ("ok" = 1)
);

INSERT INTO "__ResetAdminGuard" ("id", "ok")
SELECT "id", 1
FROM "User"
WHERE "username" = '$admin_username'
  AND "role" = 'admin';

CREATE TEMP TABLE "__ResetAdminCountGuard" (
  "adminCount" INTEGER NOT NULL CHECK ("adminCount" = 1)
);

INSERT INTO "__ResetAdminCountGuard" ("adminCount")
SELECT COUNT(*)
FROM "__ResetAdminGuard";

DELETE FROM "ShareLink";
DELETE FROM "CompanionMemoryRevision";
DELETE FROM "CompanionMemory";
DELETE FROM "CompanionMessage";
DELETE FROM "Message";
DELETE FROM "WorldBookCharacter";
DELETE FROM "WorldBookEntry";
DELETE FROM "ModelFallbackCandidate";

DELETE FROM "Conversation";
DELETE FROM "Companion";
DELETE FROM "WorldBook";
DELETE FROM "Character";

DELETE FROM "ModelFallbackGroup";
DELETE FROM "ProviderModel";
DELETE FROM "ModelProvider";
DELETE FROM "PromptPreset";
DELETE FROM "UserPersona";

DELETE FROM "Asset";
DELETE FROM "AppSetting";

DELETE FROM "User"
WHERE "id" <> (SELECT "id" FROM "__ResetAdminGuard");

UPDATE "User"
SET "role" = 'admin',
    "isActive" = 1,
    "deletedAt" = NULL
WHERE "id" = (SELECT "id" FROM "__ResetAdminGuard");

COMMIT;

PRAGMA foreign_key_check;
SQL

echo '正在硬删除管理员之外的全部数据库数据……'
docker compose run --rm -T --no-deps \
  --entrypoint pnpm \
  server exec prisma db execute \
  --schema prisma/schema.prisma \
  --stdin <"$sql_file"

echo '正在校验数据库清理结果……'
docker compose run --rm -T --no-deps --entrypoint node server -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const expected = process.argv[1];
(async () => {
  const users = await prisma.user.findMany({
    select: { username: true, role: true, isActive: true, deletedAt: true }
  });
  const emptyModels = {
    ShareLink: prisma.shareLink,
    CompanionMemoryRevision: prisma.companionMemoryRevision,
    CompanionMemory: prisma.companionMemory,
    CompanionMessage: prisma.companionMessage,
    Companion: prisma.companion,
    Message: prisma.message,
    Conversation: prisma.conversation,
    WorldBookCharacter: prisma.worldBookCharacter,
    WorldBookEntry: prisma.worldBookEntry,
    WorldBook: prisma.worldBook,
    Character: prisma.character,
    ModelFallbackCandidate: prisma.modelFallbackCandidate,
    ModelFallbackGroup: prisma.modelFallbackGroup,
    ProviderModel: prisma.providerModel,
    ModelProvider: prisma.modelProvider,
    PromptPreset: prisma.promptPreset,
    UserPersona: prisma.userPersona,
    Asset: prisma.asset,
    AppSetting: prisma.appSetting
  };
  const counts = Object.fromEntries(
    await Promise.all(
      Object.entries(emptyModels).map(async ([name, model]) => [name, await model.count()])
    )
  );
  const foreignKeyErrors = await prisma.$queryRawUnsafe("PRAGMA foreign_key_check");
  if (
    users.length !== 1 ||
    users[0].username !== expected ||
    users[0].role !== "admin" ||
    !users[0].isActive ||
    users[0].deletedAt !== null
  ) {
    throw new Error("管理员保留结果不符合预期。");
  }
  const remaining = Object.entries(counts).filter(([, count]) => count !== 0);
  if (remaining.length > 0) {
    throw new Error(`仍有业务表未清空：${JSON.stringify(remaining)}`);
  }
  if (!Array.isArray(foreignKeyErrors) || foreignKeyErrors.length > 0) {
    throw new Error("数据库存在外键异常。");
  }
  console.log(`数据库校验通过，仅保留管理员：${expected}`);
})()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
' "$admin_username"

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
echo '硬清理完成。'
echo "唯一保留管理员：$admin_username"
echo "操作前备份：$backup_file"
echo '未执行 db:seed。'
