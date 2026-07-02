/* eslint-disable */
// One-off: fix 'any' config baseUrl -> /v1, then verify stream call returns JSON (not WAF HTML).
const path = require('path');
const crypto = require('crypto');

process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'file:' + path.join(__dirname, '..', 'data', 'tavern-lite.db');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const SECRET = process.env.AUTH_TOKEN_SECRET || 'dev-only-change-me';
const key = crypto.createHash('sha256').update(SECRET).digest();
function decrypt(value) {
  if (!value) return null;
  if (!value.startsWith('v1:')) return value;
  const [, ivB, tagB, ctB] = value.split(':');
  if (!ivB || !tagB || !ctB) return null;
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'));
    d.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ctB, 'base64')), d.final()]).toString('utf8');
  } catch { return null; }
}
function toUrl(baseUrl) { const b = baseUrl.replace(/\/+$/g, ''); return b.endsWith('/chat/completions') ? b : `${b}/chat/completions`; }

(async () => {
  const before = await prisma.modelConfig.findFirst({ where: { name: 'any', deletedAt: null } });
  if (!before) { console.log('no any config'); await prisma.$disconnect(); return; }
  console.log('before baseUrl:', before.baseUrl, '| model:', before.model);

  const updated = await prisma.modelConfig.update({
    where: { id: before.id },
    data: { baseUrl: 'https://anyrouter.top/v1' }
  });
  console.log('after  baseUrl:', updated.baseUrl, '| model:', updated.model);

  // Verify: stream call with the (unchanged) model — expect JSON 404, not WAF HTML.
  const apiKey = decrypt(updated.apiKeyCiphertext);
  const url = toUrl(updated.baseUrl);
  console.log('verify POST', url, '| stream=true | model=', updated.model);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: updated.model, messages: [{ role: 'user', content: 'ping' }], stream: true })
  });
  console.log('status:', res.status, '| content-type:', res.headers.get('content-type'), '| x-tengine-error:', res.headers.get('x-tengine-error'));
  const text = await res.text();
  console.log('body head:', text.slice(0, 400));
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
