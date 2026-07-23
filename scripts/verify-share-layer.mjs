import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { baseParse, NodeTypes } from '@vue/compiler-dom';
import { parse as parseSfc } from '@vue/compiler-sfc';

const shareManagerSource = readFileSync(
  new URL('../apps/web/src/components/ShareManager.vue', import.meta.url),
  'utf8'
);
const shareManagerTemplate = parseSfc(shareManagerSource).descriptor.template?.content ?? '';
const shareManagerAst = baseParse(shareManagerTemplate);
const shareManagerRoots = shareManagerAst.children.filter(
  (node) => node.type === NodeTypes.ELEMENT
);
assert.equal(shareManagerRoots.length, 1, 'ShareManager must expose a single layout root.');
assert.equal(shareManagerRoots[0].tag, 'div');
assert.match(shareManagerTemplate, /<n-drawer\b/);
assert.doesNotMatch(shareManagerTemplate, /<n-modal\b/);
const shareChatSource = readFileSync(
  new URL('../apps/share-web/src/views/ShareChatView.vue', import.meta.url),
  'utf8'
);
const shareChatScript = parseSfc(shareChatSource).descriptor.scriptSetup?.content ?? '';
const optimisticAppendIndex = shareChatScript.indexOf('appendOptimisticTurn(text)');
const streamStartIndex = shareChatScript.indexOf(
  "await runStream('/chat/stream', { userMessage: text })"
);
assert.ok(optimisticAppendIndex >= 0, 'Share chat must append the local turn immediately.');
assert.ok(
  streamStartIndex > optimisticAppendIndex,
  'Share chat must render the local turn before awaiting the model stream.'
);
assert.match(
  shareChatScript,
  /createLocalMessage\('assistant', '', 'generating'\)/,
  'Share chat must show an assistant generating placeholder.'
);
assert.match(
  shareChatScript,
  /message\.messageId = data\.messageId/,
  'The first model delta must reuse the optimistic assistant placeholder.'
);
assert.match(
  shareChatScript,
  /appendOptimisticAssistant\(messageId\)/,
  'Regeneration must identify the assistant message being replaced.'
);
assert.match(
  shareChatScript,
  /messages\.value\.splice\(replaceIndex, 1, message\)/,
  'Regeneration must replace the previous reply with a generating placeholder in place.'
);
if (process.env.SHARE_LAYOUT_ONLY === '1') {
  console.log(
    JSON.stringify({
      ok: true,
      checks: ['drawer-layout', 'optimistic-chat-turn', 'in-place-regeneration']
    })
  );
  process.exit(0);
}

const base = process.env.SHARE_TEST_API_BASE ?? 'http://127.0.0.1:3112/api';
const rootPassword = process.env.SHARE_TEST_ROOT_PASSWORD ?? 'share-root-pass';
const memberPassword = process.env.SHARE_TEST_MEMBER_PASSWORD ?? 'share-member-pass';
const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);

const mock = http.createServer((request, response) => {
  if (!request.url?.endsWith('/chat/completions')) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/event-stream' });
  setTimeout(() => {
    response.write(
      `data: ${JSON.stringify({ choices: [{ delta: { content: '共享回复' } }] })}\n\n`
    );
    response.write(
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`
    );
    response.end('data: [DONE]\n\n');
  }, 700);
});
await new Promise((resolve) => mock.listen(3222, '127.0.0.1', resolve));

async function json(path, init = {}) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  return { response, body };
}
async function login(username, password) {
  const { response, body } = await json('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  assert.equal(response.status, 200);
  return body.data.accessToken;
}
async function managed(token, path, init = {}) {
  const { response, body } = await json(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    }
  });
  assert.equal(response.ok, true, `${path}: ${JSON.stringify(body)}`);
  return body.data;
}
function tokenFrom(link) {
  return decodeURIComponent(new URL(link.shareUrl).pathname.split('/').at(-1));
}
function publicPath(token, tail) {
  return `/public/shares/${encodeURIComponent(token)}${tail}`;
}
async function createLink(auth, targetType, targetId, permission = 'chat', expiresAt = null) {
  return managed(auth, '/shares', {
    method: 'POST',
    body: JSON.stringify({ targetType, targetId, permission, expiresAt })
  });
}
async function consume(response) {
  return response.text();
}
async function waitForSseEvent(response, expectedEvent) {
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const deadline = Date.now() + 5000;
  try {
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const result = await Promise.race([
        reader.read(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timed out waiting for ${expectedEvent}.`)), remaining)
        )
      ]);
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? '';
      if (frames.some((frame) => frame.includes(`event: ${expectedEvent}`))) return true;
    }
    return false;
  } finally {
    await reader.cancel();
  }
}

try {
  const rootToken = await login('root', rootPassword);
  const memberToken = await login('member', memberPassword);
  const root = await prisma.user.findUniqueOrThrow({ where: { username: 'root' } });
  const member = await prisma.user.findUniqueOrThrow({ where: { username: 'member' } });
  const character = await prisma.character.create({
    data: { userId: root.id, name: `Share Character ${suffix}` }
  });
  const conversation = await prisma.conversation.create({
    data: { userId: root.id, characterId: character.id, title: `Share Conversation ${suffix}` }
  });
  const companion = await prisma.companion.create({
    data: {
      userId: root.id,
      name: `Share Companion ${suffix}`,
      coreIdentity: 'INTERNAL_IDENTITY_MUST_NOT_LEAK',
      memory: { create: {} }
    }
  });
  const foreignCharacter = await prisma.character.create({
    data: { userId: member.id, name: `Foreign ${suffix}` }
  });
  const foreignConversation = await prisma.conversation.create({
    data: { userId: member.id, characterId: foreignCharacter.id, title: `Foreign ${suffix}` }
  });
  const provider = await managed(rootToken, '/model-providers', {
    method: 'POST',
    body: JSON.stringify({
      name: `Share Mock ${suffix}`,
      providerName: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:3222/v1',
      apiKey: 'test-only-key',
      isEnabled: true
    })
  });
  const model = await managed(rootToken, '/provider-models', {
    method: 'POST',
    body: JSON.stringify({
      providerId: provider.id,
      name: `Share Model ${suffix}`,
      modelName: 'share-test-model',
      isEnabled: true
    })
  });
  const group = await managed(rootToken, '/model-fallback-groups', {
    method: 'POST',
    body: JSON.stringify({
      name: `Share Group ${suffix}`,
      isEnabled: true,
      candidates: [{ modelId: model.id, priority: 1, isEnabled: true }]
    })
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { modelFallbackGroupId: group.id }
  });
  await prisma.companion.update({
    where: { id: companion.id },
    data: { modelFallbackGroupId: group.id }
  });
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: '初始消息',
      metadataJson: '{"secret":"MUST_NOT_LEAK"}'
    }
  });

  const ownership = await json('/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
    body: JSON.stringify({
      targetType: 'conversation',
      targetId: conversation.id,
      permission: 'chat'
    })
  });
  assert.equal(ownership.response.status, 404);
  const rootCannotCreateForeign = await json('/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rootToken}` },
    body: JSON.stringify({
      targetType: 'conversation',
      targetId: foreignConversation.id,
      permission: 'chat'
    })
  });
  assert.equal(rootCannotCreateForeign.response.status, 404);

  const link = await createLink(rootToken, 'conversation', conversation.id);
  const memberLink = await createLink(memberToken, 'conversation', foreignConversation.id);
  const memberOwnList = await managed(memberToken, '/shares');
  assert.equal(
    memberOwnList.items.some((item) => item.id === link.id),
    false
  );
  assert.equal(
    memberOwnList.items.some((item) => item.id === memberLink.id),
    true
  );
  const adminAuditList = await managed(rootToken, '/shares');
  const auditedMemberLink = adminAuditList.items.find((item) => item.id === memberLink.id);
  assert.equal(auditedMemberLink.owner.username, 'member');
  assert.equal(auditedMemberLink.targetTitle, foreignConversation.title);
  const adminCannotEditMember = await json(`/shares/${memberLink.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rootToken}` },
    body: JSON.stringify({ permission: 'readonly' })
  });
  assert.equal(adminCannotEditMember.response.status, 404);
  const adminCannotRegenerateMember = await json(`/shares/${memberLink.id}/regenerate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${rootToken}` }
  });
  assert.equal(adminCannotRegenerateMember.response.status, 404);
  const adminRevokedMember = await managed(rootToken, `/shares/${memberLink.id}`, {
    method: 'DELETE'
  });
  assert.equal(adminRevokedMember.revoked, true);
  const token = tokenFrom(link);
  const bootstrap = await json(publicPath(token, '/bootstrap'));
  assert.equal(bootstrap.response.status, 200);
  assert.equal(bootstrap.body.targetType, 'conversation');
  assert.equal(JSON.stringify(bootstrap.body).includes('MUST_NOT_LEAK'), false);
  const messages = await json(publicPath(token, '/messages'));
  assert.equal(messages.response.status, 200);
  assert.deepEqual(
    Object.keys(messages.body[0]).sort(),
    ['content', 'createdAt', 'messageId', 'role', 'status', 'updatedAt'].sort()
  );
  const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
  assert.equal((await json(publicPath(tampered, '/bootstrap'))).response.status, 404);

  const managedEvents = await fetch(
    `${base}/shares/events?targetType=conversation&targetId=${encodeURIComponent(conversation.id)}`,
    { headers: { Authorization: `Bearer ${rootToken}`, Accept: 'text/event-stream' } }
  );
  const managedEventResult = waitForSseEvent(managedEvents, 'generation_done');
  const firstRequest = fetch(`${base}${publicPath(token, '/chat/stream')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ userMessage: '并发测试一' })
  });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const busy = await fetch(`${base}${publicPath(token, '/chat/stream')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ userMessage: '并发测试二' })
  });
  assert.equal(busy.status, 409);
  const firstResponse = await firstRequest;
  assert.match(await consume(firstResponse), /event: done/);
  assert.equal(await managedEventResult, true);
  const persisted = await prisma.message.findMany({
    where: { conversationId: conversation.id, deletedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
  });
  assert.equal(
    persisted.some((item) => item.content === '并发测试一'),
    true
  );
  assert.equal(
    persisted.some((item) => item.content.includes('共享回复')),
    true
  );

  const companionLink = await createLink(rootToken, 'companion', companion.id, 'readonly');
  const companionToken = tokenFrom(companionLink);
  const readonly = await fetch(`${base}${publicPath(companionToken, '/chat/stream')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userMessage: '禁止写入' })
  });
  assert.equal(readonly.status, 403);
  await managed(rootToken, `/shares/${companionLink.id}`, {
    method: 'PUT',
    body: JSON.stringify({ permission: 'chat' })
  });
  const companionStream = await fetch(`${base}${publicPath(companionToken, '/chat/stream')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ userMessage: 'Companion 共享消息' })
  });
  assert.match(await consume(companionStream), /event: done/);
  assert.equal(
    (await prisma.companionMessage.count({ where: { companionId: companion.id } })) >= 2,
    true
  );

  const regenerated = await managed(rootToken, `/shares/${link.id}/regenerate`, { method: 'POST' });
  assert.equal((await json(publicPath(token, '/bootstrap'))).response.status, 404);
  assert.equal((await json(publicPath(tokenFrom(regenerated), '/bootstrap'))).response.status, 200);
  const bulkA = await createLink(rootToken, 'conversation', conversation.id);
  const bulkB = await createLink(rootToken, 'conversation', conversation.id, 'readonly');
  const bulk = await managed(rootToken, '/shares/bulk-revoke', {
    method: 'POST',
    body: JSON.stringify({ targetType: 'conversation', targetId: conversation.id })
  });
  assert.equal(bulk.revokedCount >= 3, true);
  assert.equal((await json(publicPath(tokenFrom(bulkA), '/bootstrap'))).response.status, 404);
  assert.equal((await json(publicPath(tokenFrom(bulkB), '/bootstrap'))).response.status, 404);

  const expiring = await createLink(
    rootToken,
    'companion',
    companion.id,
    'readonly',
    new Date(Date.now() + 700).toISOString()
  );
  await new Promise((resolve) => setTimeout(resolve, 850));
  assert.equal((await json(publicPath(tokenFrom(expiring), '/bootstrap'))).response.status, 404);
  console.log(
    JSON.stringify({
      ok: true,
      conversationId: conversation.id,
      companionId: companion.id,
      checks: [
        'ownership',
        'admin-audit',
        'admin-revoke',
        'drawer-layout',
        'public-dto',
        'tamper',
        'chat-stream',
        'shared-lock',
        'target-events',
        'readonly',
        'companion-stream',
        'regenerate',
        'bulk-revoke',
        'expiry'
      ]
    })
  );
} finally {
  mock.close();
  await prisma.$disconnect();
}
