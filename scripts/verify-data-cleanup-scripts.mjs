import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
const keepAccountsScript = readFileSync(
  resolve(root, 'scripts/reset-keep-accounts-models.sh'),
  'utf8'
);
const keepAdminScript = readFileSync(resolve(root, 'scripts/reset-keep-admin.sh'), 'utf8');
const moduleScript = readFileSync(resolve(root, 'scripts/reset-module-data.sh'), 'utf8');
const usageDocument = readFileSync(resolve(root, 'docs/server-data-cleanup.md'), 'utf8');

const schemaModels = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]).sort();

function parseExpectedTables(script, scriptName) {
  const match = script.match(/const expectedTables = \[([\s\S]*?)\]\.sort\(\);/);
  if (!match) {
    throw new Error(`${scriptName} 缺少 expectedTables schema 守卫。`);
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]).sort();
}

function assertSameTables(actual, expected, label) {
  const missing = expected.filter((name) => !actual.includes(name));
  const extra = actual.filter((name) => !expected.includes(name));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${label} 与 Prisma schema 不一致：缺少 ${JSON.stringify(missing)}；多出 ${JSON.stringify(extra)}`
    );
  }
}

function parseUnconditionalDeletes(script) {
  return [...script.matchAll(/^DELETE FROM "([^"]+)";$/gm)].map((match) => match[1]);
}

for (const [name, script] of [
  ['reset-keep-accounts-models.sh', keepAccountsScript],
  ['reset-keep-admin.sh', keepAdminScript],
  ['reset-module-data.sh', moduleScript]
]) {
  assertSameTables(parseExpectedTables(script, name), schemaModels, name);
}

const accountAndModelTables = new Set([
  'User',
  'ModelProvider',
  'ProviderModel',
  'ModelFallbackGroup',
  'ModelFallbackCandidate'
]);
const keepAccountsDeletes = parseUnconditionalDeletes(keepAccountsScript);
assertSameTables(
  keepAccountsDeletes,
  schemaModels.filter((name) => !accountAndModelTables.has(name)),
  'reset-keep-accounts-models.sh 删除表'
);

const keepAdminDeletes = parseUnconditionalDeletes(keepAdminScript);
assertSameTables(
  keepAdminDeletes,
  schemaModels.filter((name) => name !== 'User'),
  'reset-keep-admin.sh 删除表'
);

const allowlistMatch = moduleScript.match(/case "\$module_name" in\s+([a-z-|]+)\)\s+;;/);
if (!allowlistMatch) {
  throw new Error('reset-module-data.sh 缺少可解析的模块白名单。');
}
const moduleNames = allowlistMatch[1].split('|');
for (const moduleName of moduleNames) {
  if (!usageDocument.includes(`\`${moduleName}\``)) {
    throw new Error(`使用文档缺少模块：${moduleName}`);
  }
}

const requiredSceneImageFragments = [
  'scene-images)',
  'DELETE FROM "MessageImageLink";',
  'DELETE FROM "ImageGenerationLease";',
  'DELETE FROM "ImageAsset";',
  'DELETE FROM "ImageGenerationBatch";',
  'DELETE FROM "Asset" WHERE "kind" = \'generated_image\';',
  'UPDATE "Conversation" SET "imageModelFallbackGroupId" = NULL;'
];
for (const fragment of requiredSceneImageFragments) {
  if (!moduleScript.includes(fragment)) {
    throw new Error(`模块清理脚本缺少场景生图边界：${fragment}`);
  }
}

const requiredQqBridgeFragments = [
  'qq-bridge)',
  'DELETE FROM "QqDelivery";',
  'DELETE FROM "QqInboundEvent";',
  'DELETE FROM "QqChatBinding";',
  'DELETE FROM "QqAccount";'
];
for (const fragment of requiredQqBridgeFragments) {
  if (!moduleScript.includes(fragment)) {
    throw new Error(`模块清理脚本缺少 QQ 接入边界：${fragment}`);
  }
}

console.log(
  `数据清理脚本验证通过：${schemaModels.length} 个 Prisma model，${moduleNames.length} 个独立清理模块。`
);
