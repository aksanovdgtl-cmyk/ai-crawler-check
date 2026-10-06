// Тесты API в Miniflare: GET /api/tools/ai-crawlers?url=... с подставными robots.txt.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startWorker, text } from './helpers/worker.mjs';

let worker;

before(async () => {
  worker = await startWorker({
    sites: {
      'https://example.com/robots.txt': () =>
        text('User-agent: GPTBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: *\nDisallow: /admin\n'),
      'https://no-robots.example/robots.txt': () => text('Not found', { status: 404 }),
      'https://broken.example/robots.txt': () => text('Server error', { status: 500 }),
      'https://moved.example/robots.txt': () => new Response(null, { status: 301, headers: { Location: 'https://example.com/robots.txt' } }),
    },
    dns: { 'internal.example': '10.0.0.5' },
  });
});

after(() => worker.dispose());

const check = async (url, init) => {
  const response = await worker.fetch(`/api/tools/ai-crawlers?url=${encodeURIComponent(url)}`, init);
  return { status: response.status, body: await response.json() };
};

test('разбирает robots.txt по 9 краулерам', async () => {
  const { status, body } = await check('https://example.com/some/page?x=1');
  assert.equal(status, 200);
  assert.equal(body.robotsUrl, 'https://example.com/robots.txt');
  assert.equal(body.exists, true);
  assert.equal(body.crawlers.length, 9);
  const byAgent = Object.fromEntries(body.crawlers.map((c) => [c.agent, c]));
  assert.equal(byAgent.GPTBot.state, 'blocked');
  assert.equal(byAgent['OAI-SearchBot'].state, 'allowed');
  assert.equal(byAgent['OAI-SearchBot'].source, 'OAI-SearchBot');
  assert.equal(byAgent.ClaudeBot.state, 'partial');
  assert.equal(byAgent.ClaudeBot.source, '*');
  assert.deepEqual(
    body.crawlers.map((c) => c.agent),
    ['OAI-SearchBot', 'GPTBot', 'ChatGPT-User', 'Claude-SearchBot', 'ClaudeBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended'],
  );
});

test('нет robots.txt - все разрешены по умолчанию', async () => {
  const { status, body } = await check('https://no-robots.example');
  assert.equal(status, 200);
  assert.equal(body.exists, false);
  assert.ok(body.crawlers.every((c) => c.state === 'allowed' && c.rule === 'robots.txt не найден'));
});

test('идет по перенаправлению на публичный адрес', async () => {
  const { body } = await check('https://moved.example');
  assert.equal(body.exists, true);
  assert.ok(worker.requests.includes('https://example.com/robots.txt'));
});

test('ошибка сервера сайта - 502 с кодом ответа', async () => {
  assert.deepEqual(await check('https://broken.example'), { status: 502, body: { error: 'robots.txt вернул код 500' } });
});

test('имя с адресом из частной сети отклоняется', async () => {
  assert.deepEqual(await check('https://internal.example'), { status: 400, body: { error: 'Укажите публичный домен сайта' } });
});

test('без адреса - 400, с lang=en ошибка по-английски', async () => {
  const ru = await worker.fetch('/api/tools/ai-crawlers');
  assert.deepEqual([ru.status, await ru.json()], [400, { error: 'Укажите адрес сайта' }]);
  const en = await worker.fetch('/api/tools/ai-crawlers?lang=en');
  assert.deepEqual([en.status, await en.json()], [400, { error: 'Enter the site URL' }]);
});

test('чужой Origin - 403, свой - 200', async () => {
  const foreign = await check('https://example.com', { headers: { Origin: 'https://evil.example' } });
  assert.equal(foreign.status, 403);
  const own = await check('https://example.com', { headers: { Origin: 'http://tool.test' } });
  assert.equal(own.status, 200);
});

test('другой маршрут и метод', async () => {
  assert.equal((await worker.fetch('/api/tools/unknown')).status, 404);
  assert.equal((await worker.fetch('/api/tools/ai-crawlers?url=https://example.com', { method: 'POST' })).status, 405);
});

test('лимит 10 запросов в минуту на IP', async () => {
  const headers = { 'CF-Connecting-IP': '192.0.2.77' };
  const codes = [];
  for (let i = 0; i < 11; i += 1) codes.push((await check('https://example.com', { headers })).status);
  assert.deepEqual(codes, [...Array(10).fill(200), 429]);
});
