/* global URL, console, fetch, process */
import { readFile } from 'node:fs/promises';

const baseUrl = process.env.TAVERN_VERIFY_BASE_URL ?? 'http://127.0.0.1:3100/api';
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const created = { admin: [], member: [] };

const accounts = await loadPresetAccounts();
const admin = accounts.find((account) => account.role === 'admin');
if (!admin) throw new Error('Verification requires one built-in administrator.');

const adminToken = await login(admin);
const memberAccount = {
  username: `verify_${suffix}`.slice(0, 48),
  displayName: '内容库验收成员',
  password: `Verify!${suffix}`,
  role: 'member'
};
const managedMember = await create(adminToken, 'admin/users', memberAccount);
const memberToken = await login(memberAccount);

try {
  const adminPersona = await create(adminToken, 'personas', {
    name: `verify-persona-${suffix}`,
    content: 'admin persona snapshot',
    isShared: true
  });
  remember('admin', 'personas', adminPersona.id);

  const adminPreset = await create(adminToken, 'prompt-presets', {
    name: `verify-preset-${suffix}`,
    description: 'admin preset snapshot',
    outputRules: 'keep replies concise',
    temperature: 0.7,
    isShared: true
  });
  remember('admin', 'prompt-presets', adminPreset.id);

  const adminCharacter = await create(adminToken, 'characters', {
    name: `verify-character-${suffix}`,
    description: 'admin character snapshot',
    isShared: true
  });
  remember('admin', 'characters', adminCharacter.id);

  const adminCharacterTwo = await create(adminToken, 'characters', {
    name: `verify-character-two-${suffix}`,
    description: 'second admin character snapshot',
    isShared: true
  });
  remember('admin', 'characters', adminCharacterTwo.id);

  const adminWorldBook = await create(adminToken, 'world-books', {
    name: `verify-world-book-${suffix}`,
    description: 'admin world book snapshot',
    characterIds: [],
    isShared: true
  });
  remember('admin', 'world-books', adminWorldBook.id);
  await create(adminToken, `world-books/${adminWorldBook.id}/entries`, {
    title: 'verification entry',
    content: 'verification content',
    keywords: ['verification']
  });

  const adminBoundWorldBook = await create(adminToken, 'world-books', {
    name: `verify-bound-world-book-${suffix}`,
    description: 'admin multi-character world book snapshot',
    characterIds: [adminCharacter.id, adminCharacterTwo.id],
    isShared: true
  });
  remember('admin', 'world-books', adminBoundWorldBook.id);
  if (adminBoundWorldBook.characterIds.length !== 2) {
    throw new Error('World book create did not preserve both character associations.');
  }

  const adminCompanion = await create(adminToken, 'companions', {
    name: `verify-companion-${suffix}`,
    identityPrompt: 'admin companion snapshot',
    promptPresetId: adminPreset.id,
    personaId: adminPersona.id,
    isShared: true
  });
  remember('admin', 'companions', adminCompanion.id);

  await assertLibraryContains(memberToken, 'characters', adminCharacter.id);
  await assertLibraryContains(memberToken, 'prompt-presets', adminPreset.id);
  await assertLibraryContains(memberToken, 'personas', adminPersona.id);
  await assertLibraryContains(memberToken, 'world-books', adminWorldBook.id);
  await assertLibraryContains(memberToken, 'world-books', adminBoundWorldBook.id);
  await assertLibraryContains(memberToken, 'companions', adminCompanion.id);

  const memberCharacter = await fork(memberToken, 'characters', adminCharacter.id);
  remember('member', 'characters', memberCharacter.id);
  assertSnapshot(memberCharacter, adminCharacter, 'character');

  const importResult = await api(memberToken, 'world-books/import', {
    method: 'POST',
    body: {
      rawJson: JSON.stringify({
        formatVersion: 'tavern-lite.world-book.v1',
        name: `verify-imported-world-book-${suffix}`,
        characterIds: [adminCharacter.id, memberCharacter.id],
        isEnabled: true,
        entries: []
      }),
      commit: true,
      duplicateNameStrategy: 'reject'
    }
  });
  const importedWorldBook = importResult.worldBook;
  remember('member', 'world-books', importedWorldBook.id);
  if (importedWorldBook.characterIds.length !== 0 || importedWorldBook.isEnabled) {
    throw new Error('World book import must remain unbound and disabled.');
  }

  const memberPreset = await fork(memberToken, 'prompt-presets', adminPreset.id);
  remember('member', 'prompt-presets', memberPreset.id);
  assertSnapshot(memberPreset, adminPreset, 'prompt preset');

  const memberPersona = await fork(memberToken, 'personas', adminPersona.id);
  remember('member', 'personas', memberPersona.id);
  assertSnapshot(memberPersona, adminPersona, 'persona');

  const memberWorldBook = await fork(memberToken, 'world-books', adminWorldBook.id, {});
  remember('member', 'world-books', memberWorldBook.id);
  assertSnapshot(memberWorldBook, adminWorldBook, 'world book');
  if (memberWorldBook.characterIds.length !== 0 || memberWorldBook.entries.length !== 1) {
    throw new Error('World book fork did not preserve account-local global scope and entries.');
  }

  const memberBoundWorldBook = await fork(memberToken, 'world-books', adminBoundWorldBook.id, {
    targetCharacterId: memberCharacter.id
  });
  remember('member', 'world-books', memberBoundWorldBook.id);
  if (
    memberBoundWorldBook.characterIds.length !== 1 ||
    memberBoundWorldBook.characterIds[0] !== memberCharacter.id
  ) {
    throw new Error('Bound world book fork did not map to the selected member character.');
  }

  const memberCompanion = await fork(memberToken, 'companions', adminCompanion.id);
  remember('member', 'companions', memberCompanion.id);
  remember('member', 'prompt-presets', memberCompanion.promptPresetId);
  remember('member', 'personas', memberCompanion.personaId);
  assertSnapshot(memberCompanion, adminCompanion, 'companion');
  if (
    !memberCompanion.promptPresetId ||
    !memberCompanion.personaId ||
    memberCompanion.promptPresetId === adminPreset.id ||
    memberCompanion.personaId === adminPersona.id
  ) {
    throw new Error('Companion fork did not deep-copy Persona and PromptPreset dependencies.');
  }
  const memory = await api(memberToken, `companions/${memberCompanion.id}/memory`);
  if (memory.relationshipState || memory.currentArc || memory.revisions.length) {
    throw new Error('Companion fork copied relationship memory unexpectedly.');
  }

  const forbiddenUpdate = await rawApi(memberToken, `characters/${adminCharacter.id}`, {
    method: 'PUT',
    body: { description: 'member must not mutate master data' }
  });
  if (forbiddenUpdate.ok) throw new Error('Member unexpectedly updated administrator master data.');

  const forbiddenPublish = await rawApi(memberToken, 'personas', {
    method: 'POST',
    body: { name: `forbidden-${suffix}`, isShared: true }
  });
  if (forbiddenPublish.status !== 403) {
    throw new Error(`Member publish should return 403, received ${forbiddenPublish.status}.`);
  }

  console.log('Shared content library verification passed for all five resource types.');
} finally {
  await cleanup(memberToken, created.member);
  await cleanup(adminToken, created.admin);
  await rawApi(adminToken, `admin/users/${managedMember.id}`, { method: 'DELETE' }).catch(
    () => undefined
  );
}

async function loadPresetAccounts() {
  const source = await readFile(new URL('../apps/server/.env', import.meta.url), 'utf8');
  const line = source.split(/\r?\n/).find((value) => value.startsWith('AUTH_PRESET_USERS_JSON='));
  if (!line) throw new Error('AUTH_PRESET_USERS_JSON is not configured.');
  let raw = line.slice(line.indexOf('=') + 1).trim();
  if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
  const parsed = JSON.parse(raw);
  return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
}

async function login(account) {
  const response = await rawApi(null, 'auth/login', {
    method: 'POST',
    body: { username: account.username, password: account.password }
  });
  if (!response.ok) throw new Error(`Login failed for ${account.username}.`);
  return response.payload.data.accessToken;
}

async function rawApi(token, path, options = {}) {
  const response = await fetch(`${baseUrl}/${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
  });
  const payload = await response.json();
  return { ok: response.ok && payload.success, status: response.status, payload };
}

async function api(token, path, options) {
  const response = await rawApi(token, path, options);
  if (!response.ok) {
    throw new Error(
      `${options?.method ?? 'GET'} ${path} failed: ${response.payload?.error?.code ?? response.status}`
    );
  }
  return response.payload.data;
}

function create(token, path, body) {
  return api(token, path, { method: 'POST', body });
}

function fork(token, path, id, body) {
  return api(token, `${path}/${id}/fork`, {
    method: 'POST',
    ...(body === undefined ? {} : { body })
  });
}

async function assertLibraryContains(token, path, id) {
  const result = await api(token, `${path}?scope=library&page=1&pageSize=100`);
  if (!result.items.some((item) => item.id === id && item.isShared && item.canFork)) {
    throw new Error(`${path} library did not expose the shared master as fork-only data.`);
  }
}

function assertSnapshot(copy, source, label) {
  if (copy.id === source.id || copy.userId === source.userId || copy.isShared || !copy.isOwner) {
    throw new Error(`${label} fork is not an independent member-owned snapshot.`);
  }
  if (copy.isSensitive !== source.isSensitive) {
    throw new Error(`${label} fork did not preserve the sensitive flag snapshot.`);
  }
}

function remember(owner, path, id) {
  if (id) created[owner].push({ path, id });
}

async function cleanup(token, records) {
  for (const record of [...records].reverse()) {
    await rawApi(token, `${record.path}/${record.id}`, { method: 'DELETE' }).catch(() => undefined);
  }
}
