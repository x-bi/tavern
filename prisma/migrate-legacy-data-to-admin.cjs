const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

async function assertNoNameConflicts(sourceId, targetId) {
  const resources = [
    ['modelProvider', '模型供应商'],
    ['modelFallbackGroup', '模型链'],
    ['promptPreset', 'Prompt 预设'],
    ['userPersona', 'Persona']
  ];
  for (const [delegateName, label] of resources) {
    const delegate = prisma[delegateName];
    const sourceNames = await delegate.findMany({ where: { userId: sourceId }, select: { name: true } });
    if (sourceNames.length === 0) continue;
    const conflict = await delegate.findFirst({
      where: { userId: targetId, name: { in: sourceNames.map((item) => item.name) } },
      select: { name: true }
    });
    if (conflict) throw new Error(`${label}存在同名数据“${conflict.name}”，迁移已取消，请先重命名后重试。`);
  }
}

async function main() {
  const sourceUsername = readArg('source', 'demo');
  const targetUsername = readArg('target', 'root');
  if (sourceUsername === targetUsername) throw new Error('源账号和目标账号不能相同。');

  const [source, target] = await Promise.all([
    prisma.user.findUnique({ where: { username: sourceUsername } }),
    prisma.user.findUnique({ where: { username: targetUsername } })
  ]);
  if (!source) throw new Error(`找不到旧账号“${sourceUsername}”。`);
  if (!target) throw new Error(`找不到管理员“${targetUsername}”，请先启动服务并登录一次管理员账号。`);
  if (target.role !== 'admin') throw new Error(`目标账号“${targetUsername}”不是管理员。`);

  await assertNoNameConflicts(source.id, target.id);
  const result = await prisma.$transaction(async (tx) => {
    const updates = {
      characters: await tx.character.updateMany({ where: { userId: source.id }, data: { userId: target.id } }),
      modelProviders: await tx.modelProvider.updateMany({ where: { userId: source.id }, data: { userId: target.id } }),
      modelFallbackGroups: await tx.modelFallbackGroup.updateMany({ where: { userId: source.id }, data: { userId: target.id } }),
      promptPresets: await tx.promptPreset.updateMany({ where: { userId: source.id }, data: { userId: target.id } }),
      personas: await tx.userPersona.updateMany({ where: { userId: source.id }, data: { userId: target.id } }),
      conversations: await tx.conversation.updateMany({ where: { userId: source.id }, data: { userId: target.id } }),
      worldBooks: await tx.worldBook.updateMany({ where: { userId: source.id }, data: { userId: target.id } }),
      assets: await tx.asset.updateMany({ where: { userId: source.id }, data: { userId: target.id } }),
      appSettings: await tx.appSetting.updateMany({ where: { userId: source.id }, data: { userId: target.id } }),
      companions: await tx.companion.updateMany({ where: { userId: source.id }, data: { userId: target.id } })
    };
    await tx.user.update({ where: { id: source.id }, data: { isActive: false, deletedAt: new Date() } });
    return Object.fromEntries(Object.entries(updates).map(([key, value]) => [key, value.count]));
  });

  console.log(JSON.stringify({ success: true, source: sourceUsername, target: targetUsername, moved: result }, null, 2));
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
