#!/usr/bin/env bash

set -Eeuo pipefail

# ==================== 基础配置 ====================

PROJECT_DIR="/opt/tavern"
BRANCH="main"

LOG_FILE="/www/wwwlogs/tavern-deploy.log"
LOCK_FILE="/tmp/tavern-deploy.lock"

# 记录最后一次成功部署的 commit
SUCCESS_COMMIT_FILE="/opt/tavern/.last-successful-deploy"

# 需要从仓库 Dockerfile 构建的服务。
BUILD_SERVICES=(
    "server"
    "web"
    "share-web"
)

# 部署完成后必须存在且处于 running 的服务。
# napcat 使用外部镜像，不加入 BUILD_SERVICES。
RUNTIME_SERVICES=(
    "server"
    "web"
    "share-web"
    "napcat"
)

# 固定宝塔计划任务运行环境
export HOME="/root"
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export DOCKER_CONFIG="/root/.docker"

# Docker Compose 同时最多执行一个任务
export COMPOSE_PARALLEL_LIMIT=1

# force 参数可以在没有新 commit 时强制重新部署
FORCE_DEPLOY="${1:-}"

# ==================== 初始化 ====================

mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

# 同时输出到宝塔任务日志和自定义日志文件
exec > >(tee -a "$LOG_FILE") 2>&1

echo
echo "============================================================"
echo "Deploy started: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# ==================== 错误处理 ====================

on_error() {
    local exit_code=$?
    local line_number="${1:-unknown}"

    echo
    echo "============================================================"
    echo "Deploy failed"
    echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Exit code: $exit_code"
    echo "Error line: $line_number"
    echo "============================================================"

    exit "$exit_code"
}

trap 'on_error $LINENO' ERR

# ==================== 防止重复执行 ====================

exec 9>"$LOCK_FILE"

if ! flock -n 9; then
    echo "Another deploy process is running. Skip this deployment."
    exit 0
fi

# ==================== 环境检查 ====================

if [ ! -d "$PROJECT_DIR" ]; then
    echo "Project directory does not exist: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

if [ ! -d ".git" ]; then
    echo "Current directory is not a Git repository: $PROJECT_DIR"
    exit 1
fi

if ! command -v git >/dev/null 2>&1; then
    echo "Git command not found."
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "Docker command not found."
    exit 1
fi

if ! command -v flock >/dev/null 2>&1; then
    echo "flock command not found."
    exit 1
fi

if ! command -v mktemp >/dev/null 2>&1; then
    echo "mktemp command not found."
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose plugin is unavailable."
    exit 1
fi

echo "User: $(whoami)"
echo "HOME: $HOME"
echo "PATH: $PATH"
echo "Project directory: $(pwd)"
echo "Current branch: $(git branch --show-current)"
echo "Git path: $(command -v git)"
echo "Docker path: $(command -v docker)"
echo "Docker version: $(docker --version)"
echo "Compose version: $(docker compose version)"
echo "Compose parallel limit: $COMPOSE_PARALLEL_LIMIT"

echo
echo "Current memory status:"
free -h || true

echo
echo "Current swap status:"
swapon --show || true

echo
echo "Current disk status:"
df -h / || true

echo
echo "Current Docker disk usage:"
docker system df || true

# ==================== 获取远程代码 ====================

echo
echo "Fetching latest code from origin/$BRANCH..."

git fetch --prune origin "$BRANCH"

REMOTE_COMMIT="$(git rev-parse "origin/$BRANCH")"
LOCAL_COMMIT="$(git rev-parse HEAD)"

LAST_SUCCESS_COMMIT=""

if [ -f "$SUCCESS_COMMIT_FILE" ]; then
    LAST_SUCCESS_COMMIT="$(tr -d '[:space:]' < "$SUCCESS_COMMIT_FILE")"
fi

echo "Local commit:           $LOCAL_COMMIT"
echo "Remote commit:          $REMOTE_COMMIT"
echo "Last successful commit: ${LAST_SUCCESS_COMMIT:-none}"

# 判断的是上次成功部署的 commit，而不是本地 HEAD。
# 即使上一次已经拉取代码但构建失败，本次仍会重新构建。
if [ "$FORCE_DEPLOY" != "force" ] &&
   [ -n "$LAST_SUCCESS_COMMIT" ] &&
   [ "$LAST_SUCCESS_COMMIT" = "$REMOTE_COMMIT" ]; then

    echo
    echo "Remote commit has already been deployed successfully."
    echo "No deployment is required."
    exit 0
fi

if [ "$FORCE_DEPLOY" = "force" ]; then
    echo
    echo "Force deployment enabled."
fi

# ==================== 同步代码 ====================

echo
echo "Synchronizing local code with origin/$BRANCH..."

git reset --hard "origin/$BRANCH"

# 删除未被 Git 跟踪的普通文件和目录。
# 不使用 -x，避免删除 .gitignore 中的数据库、环境变量和上传文件。
git clean -fd

CURRENT_COMMIT="$(git rev-parse HEAD)"

echo "Code synchronized successfully."
echo "Current commit: $CURRENT_COMMIT"
echo "Commit message: $(git log -1 --pretty=%s)"

# ==================== 验证 Docker Compose ====================

echo
echo "Validating Docker Compose configuration..."

docker compose config --quiet

AVAILABLE_SERVICES="$(docker compose config --services)"

echo
echo "Available Docker Compose services:"
printf '%s\n' "$AVAILABLE_SERVICES"

for service in "${RUNTIME_SERVICES[@]}"; do
    if ! printf '%s\n' "$AVAILABLE_SERVICES" | grep -Fxq "$service"; then
        echo
        echo "Docker Compose service does not exist: $service"
        echo "Please check RUNTIME_SERVICES and docker-compose.yml."
        exit 1
    fi
done

# ==================== Docker 构建函数 ====================

build_service() {
    local service="$1"
    local build_log

    build_log="$(mktemp "/tmp/tavern-build-${service}.XXXXXX.log")"

    echo "Running normal build with cache: $service"

    # 正常情况下使用缓存；--pull 只检查基础镜像更新，不禁用构建缓存。
    if COMPOSE_PARALLEL_LIMIT=1 \
        docker compose build --pull "$service" 2>&1 | tee "$build_log"; then

        rm -f -- "$build_log"
        return 0
    fi

    # 只对 Docker/BuildKit 内容存储损坏进行一次恢复。
    # 普通 TypeScript、依赖安装或网络错误保持原失败，不清理缓存。
    if ! grep -Eiq \
        'short read|unexpected EOF|failed to compute cache key' \
        "$build_log"; then

        echo
        echo "Build failed, but it is not a recognized Docker cache corruption error."
        rm -f -- "$build_log"
        return 1
    fi

    echo
    echo "Detected corrupted Docker/BuildKit cache while building: $service"
    echo "Cleaning unused build cache and retrying once without cache..."

    # 只清理未使用的构建缓存，不删除容器、volume、data 或 uploads。
    docker builder prune -af

    # 三个自建镜像的构建阶段都使用该基础镜像。
    # 删除失败可忽略，后续 --pull 会重新获取基础镜像。
    docker image rm -f node:22-bookworm-slim || true
    docker pull node:22-bookworm-slim

    if COMPOSE_PARALLEL_LIMIT=1 \
        docker compose build --pull --no-cache "$service"; then

        rm -f -- "$build_log"
        echo "Cache recovery build succeeded: $service"
        return 0
    fi

    rm -f -- "$build_log"
    echo "Cache recovery build failed: $service"
    return 1
}

# ==================== 逐个构建镜像 ====================

echo
echo "Building Docker images sequentially..."
echo "Build order: ${BUILD_SERVICES[*]}"

for service in "${BUILD_SERVICES[@]}"; do
    echo
    echo "============================================================"
    echo "Building service: $service"
    echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "============================================================"

    # 每次只构建一个服务，避免 server 和 web 同时占用内存。
    # 缓存损坏时 build_service 只自动恢复一次。
    build_service "$service"

    echo
    echo "Service image built successfully: $service"
    echo "Finished at: $(date '+%Y-%m-%d %H:%M:%S')"

    echo
    echo "Memory status after building $service:"
    free -h || true

    echo
    echo "Swap status after building $service:"
    swapon --show || true
done

echo
echo "All Docker images were built successfully."

# ==================== 启动容器 ====================

echo
echo "Recreating containers with newly built images..."

# 使用 --no-build，确保这里不会再次构建自建镜像。
# NapCat 是外部镜像；本地不存在时 Compose 会自动拉取。
docker compose up \
    -d \
    --no-build \
    --force-recreate \
    --remove-orphans

echo
echo "Docker Compose deployment command completed."

# ==================== 检查容器状态 ====================

echo
echo "Waiting for containers to initialize..."

sleep 10

echo
echo "Current Docker Compose status:"

docker compose ps

FAILED_CONTAINERS="$(
    docker compose ps --all --format json 2>/dev/null |
    grep -Ei '"State":"(exited|dead|removing|restarting)"' || true
)"

if [ -n "$FAILED_CONTAINERS" ]; then
    echo
    echo "One or more containers are not running correctly:"
    echo "$FAILED_CONTAINERS"

    echo
    echo "Recent container logs:"
    docker compose logs --tail=150 || true

    exit 1
fi

# 逐个检查所有运行服务，包括外部镜像 NapCat。
for service in "${RUNTIME_SERVICES[@]}"; do
    CONTAINER_ID="$(docker compose ps -q "$service")"

    if [ -z "$CONTAINER_ID" ]; then
        echo
        echo "No container was found for service: $service"

        echo
        echo "Recent logs for $service:"
        docker compose logs --tail=150 "$service" || true

        exit 1
    fi

    CONTAINER_STATE="$(
        docker inspect \
            --format '{{.State.Status}}' \
            "$CONTAINER_ID" 2>/dev/null || true
    )"

    echo "Service $service state: ${CONTAINER_STATE:-unknown}"

    if [ "$CONTAINER_STATE" != "running" ]; then
        echo
        echo "Service is not running correctly: $service"

        echo
        echo "Recent logs for $service:"
        docker compose logs --tail=150 "$service" || true

        exit 1
    fi
done

# ==================== 标记部署成功 ====================

# 只有镜像构建完成并且所有容器正常运行后，才记录成功 commit。
TEMP_SUCCESS_FILE="${SUCCESS_COMMIT_FILE}.tmp"

printf '%s\n' "$CURRENT_COMMIT" > "$TEMP_SUCCESS_FILE"
mv -f "$TEMP_SUCCESS_FILE" "$SUCCESS_COMMIT_FILE"

echo
echo "Recorded successful deployment commit: $CURRENT_COMMIT"

# ==================== 清理无用镜像 ====================

echo
echo "Cleaning unused Docker images..."

# 只删除悬空镜像，不删除 volume、运行容器或全部构建缓存。
docker image prune -f

# ==================== 完成 ====================

echo
echo "Final Docker Compose status:"
docker compose ps

echo
echo "Final memory status:"
free -h || true

echo
echo "Final swap status:"
swapon --show || true

echo
echo "Final Docker disk usage:"
docker system df || true

echo
echo "============================================================"
echo "Deploy finished successfully"
echo "Commit: $CURRENT_COMMIT"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
