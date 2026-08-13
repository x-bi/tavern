import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const deployScript = readFileSync(resolve(root, 'scripts/tavern-auto-deploy.sh'), 'utf8');
const compose = readFileSync(resolve(root, 'docker-compose.yml'), 'utf8');
const dockerfiles = ['Dockerfile.server', 'Dockerfile.web', 'Dockerfile.share-web'].map((name) => [
  name,
  readFileSync(resolve(root, name), 'utf8')
]);

function requireFragment(content, fragment, label) {
  if (!content.includes(fragment)) {
    throw new Error(`${label} 缺少：${fragment}`);
  }
}

function requireBefore(content, first, second, label) {
  const firstIndex = content.indexOf(first);
  const secondIndex = content.indexOf(second);
  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) {
    throw new Error(`${label} 顺序不正确：${first} 必须早于 ${second}`);
  }
}

for (const fragment of [
  'export COMPOSE_PARALLEL_LIMIT=1',
  'LOW_MEMORY_MODE="${LOW_MEMORY_MODE:-1}"',
  'MIN_SWAP_MB="${MIN_SWAP_MB:-2048}"',
  'MIN_BUILD_HEADROOM_MB="${MIN_BUILD_HEADROOM_MB:-3072}"',
  'STARTUP_SETTLE_SECONDS="${STARTUP_SETTLE_SECONDS:-8}"',
  'restore_stopped_containers()',
  'CAN_RESTORE_STOPPED_CONTAINERS=1',
  'docker compose stop --timeout 30 "$service"',
  'for service in "${BUILD_SERVICES[@]}"; do',
  'Recreating containers one by one with newly built images...',
  '--no-deps',
  'Service failed during sequential startup'
]) {
  requireFragment(deployScript, fragment, '低内存部署脚本');
}

requireBefore(
  deployScript,
  'Stopping running containers before build to release memory...',
  'Building Docker images sequentially...',
  '停服与构建'
);
requireBefore(
  deployScript,
  'Building Docker images sequentially...',
  'Recreating containers one by one with newly built images...',
  '构建与启动'
);

if (deployScript.includes('docker compose down')) {
  throw new Error('低内存部署不得使用 docker compose down，以便构建失败时恢复旧容器。');
}
if (deployScript.includes('docker system prune')) {
  throw new Error('低内存部署不得清理容器或 volume。');
}

for (const [name, dockerfile] of dockerfiles) {
  for (const fragment of [
    'ARG NODE_BUILD_MAX_OLD_SPACE_MB=768',
    'NODE_OPTIONS="--max-old-space-size=${NODE_BUILD_MAX_OLD_SPACE_MB}"',
    'npm_config_jobs=1',
    'pnpm config set child-concurrency 1'
  ]) {
    requireFragment(dockerfile, fragment, name);
  }
}
requireFragment(dockerfiles[0][1], 'ENV NODE_OPTIONS=""', 'Dockerfile.server 运行阶段');

const buildArgCount = [...compose.matchAll(/^\s+NODE_BUILD_MAX_OLD_SPACE_MB:/gm)].length;
if (buildArgCount !== 3) {
  throw new Error(
    `docker-compose.yml 应为三个自建镜像传递 Node heap 上限，实际为 ${buildArgCount}。`
  );
}

console.log('低内存部署回归校验通过：串行构建、停服恢复、逐个启动和构建内存上限均存在。');
