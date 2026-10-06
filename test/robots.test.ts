// Модульные тесты: разбор robots.txt и выбор правила для бота.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateCrawler, parseRobots } from '../src/core/robots.ts';

const gptbot = { agent: 'GPTBot', company: 'OpenAI', purpose: 'Обучение' };
const searchbot = { agent: 'OAI-SearchBot', company: 'OpenAI', purpose: 'AI-поиск' };

test('parseRobots: группы, несколько User-agent подряд, комментарии и BOM', () => {
  const groups = parseRobots('﻿User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: / # закрыть обучение\n\nUser-agent: *\nAllow: /\n');
  assert.deepEqual(groups, [
    { agents: ['gptbot', 'claudebot'], rules: [{ type: 'disallow', path: '/', raw: 'Disallow: /' }] },
    { agents: ['*'], rules: [{ type: 'allow', path: '/', raw: 'Allow: /' }] },
  ]);
});

test('отдельная группа бота важнее общей', () => {
  const groups = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /\n');
  const result = evaluateCrawler(groups, gptbot);
  assert.equal(result.state, 'allowed');
  assert.equal(result.source, 'GPTBot');
  assert.equal(result.rule, 'Allow: /');
});

test('бот без своей группы получает правила User-agent: *', () => {
  const groups = parseRobots('User-agent: *\nDisallow: /\n');
  const result = evaluateCrawler(groups, searchbot);
  assert.equal(result.state, 'blocked');
  assert.equal(result.source, '*');
  assert.equal(result.rule, 'Disallow: /');
});

test('запрет части сайта - частичный доступ', () => {
  const groups = parseRobots('User-agent: *\nDisallow: /admin\nDisallow: /api/\n');
  const result = evaluateCrawler(groups, searchbot);
  assert.equal(result.state, 'partial');
  assert.equal(result.rule, 'Disallow: /admin');
});

test('пустой Disallow ничего не запрещает', () => {
  const groups = parseRobots('User-agent: *\nDisallow:\n');
  assert.equal(evaluateCrawler(groups, searchbot).state, 'allowed');
});

test('при равной длине правил для корня Allow сильнее Disallow: бот не заблокирован', () => {
  const groups = parseRobots('User-agent: GPTBot\nDisallow: /\nAllow: /\n');
  // любой непустой Disallow остается в результате как частичный доступ
  assert.equal(evaluateCrawler(groups, gptbot).state, 'partial');
});

test('нет правил для бота - доступ по умолчанию', () => {
  const result = evaluateCrawler(parseRobots('User-agent: Googlebot\nDisallow: /\n'), gptbot);
  assert.equal(result.state, 'allowed');
  assert.equal(result.source, 'По умолчанию');
});
