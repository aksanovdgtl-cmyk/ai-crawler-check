// Проверка доступа AI-краулеров: robots.txt сайта и правила для 9 ботов.
// Источник: сервер инструментов hitz.agency (https://hitz.agency/tools).
import { assertPublicWebsiteUrl, fetchWithSafeRedirects, readLimitedText } from './net.ts';

interface Crawler {
  agent: string;
  company: string;
  purpose: string;
}

const AI_CRAWLERS: Crawler[] = [
  { agent: 'OAI-SearchBot', company: 'OpenAI', purpose: 'AI-поиск' },
  { agent: 'GPTBot', company: 'OpenAI', purpose: 'Обучение' },
  { agent: 'ChatGPT-User', company: 'OpenAI', purpose: 'Запрос пользователя' },
  { agent: 'Claude-SearchBot', company: 'Anthropic', purpose: 'AI-поиск' },
  { agent: 'ClaudeBot', company: 'Anthropic', purpose: 'Обучение' },
  { agent: 'Claude-User', company: 'Anthropic', purpose: 'Запрос пользователя' },
  { agent: 'PerplexityBot', company: 'Perplexity', purpose: 'AI-поиск' },
  { agent: 'Perplexity-User', company: 'Perplexity', purpose: 'Запрос пользователя' },
  { agent: 'Google-Extended', company: 'Google', purpose: 'Gemini и обучение' },
];

interface RobotsRule {
  type: 'allow' | 'disallow';
  path: string;
  raw: string;
}

interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

export function parseRobots(content: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let agents: string[] = [];
  let rules: RobotsRule[] = [];

  const commit = () => {
    if (agents.length) groups.push({ agents: [...agents], rules: [...rules] });
    agents = [];
    rules = [];
  };

  for (const sourceLine of content.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = sourceLine.replace(/\s+#.*$/, '').trim();
    if (!line || !line.includes(':')) continue;
    const split = line.indexOf(':');
    const key = line.slice(0, split).trim().toLowerCase();
    const value = line.slice(split + 1).trim();

    if (key === 'user-agent') {
      if (rules.length) commit();
      agents.push(value.toLowerCase());
    } else if (agents.length && (key === 'allow' || key === 'disallow')) {
      rules.push({
        type: key,
        path: value,
        raw: `${key.charAt(0).toUpperCase()}${key.slice(1)}: ${value}`,
      });
    }
  }

  commit();
  return groups;
}

export function evaluateCrawler(groups: RobotsGroup[], crawler: Crawler) {
  const token = crawler.agent.toLowerCase();
  const exact = groups.filter((group) => group.agents.includes(token));
  const wildcard = groups.filter((group) => group.agents.includes('*'));
  const selected = exact.length ? exact : wildcard;
  const rules = selected.flatMap((group) => group.rules);
  const rootRules = rules.filter((rule) => rule.path && '/'.startsWith(rule.path));
  rootRules.sort((a, b) => b.path.length - a.path.length || (a.type === 'allow' ? -1 : 1));
  const rootRule = rootRules[0];
  const blocked = rootRule?.type === 'disallow';
  const partial = !blocked && rules.some((rule) => rule.type === 'disallow' && rule.path);
  const state = blocked ? 'blocked' : partial ? 'partial' : 'allowed';
  const source = exact.length ? crawler.agent : wildcard.length ? '*' : 'По умолчанию';
  const matched = blocked
    ? rootRule?.raw
    : partial
      ? rules.find((rule) => rule.type === 'disallow' && rule.path)?.raw
      : rules.find((rule) => rule.type === 'allow')?.raw || 'Запрещающих правил нет';

  return { ...crawler, state, source, rule: matched };
}

export async function checkAiCrawlers(rawUrl: string) {
  const website = assertPublicWebsiteUrl(rawUrl);
  const robotsUrl = new URL('/robots.txt', website.origin).href;
  const response = await fetchWithSafeRedirects(robotsUrl);

  if (response.status === 404) {
    return {
      robotsUrl,
      status: 404,
      exists: false,
      content: '',
      crawlers: AI_CRAWLERS.map((crawler) => ({
        ...crawler,
        state: 'allowed',
        source: 'По умолчанию',
        rule: 'robots.txt не найден',
      })),
    };
  }

  if (!response.ok) throw new Error(`robots.txt вернул код ${response.status}`);
  const content = await readLimitedText(response);
  const groups = parseRobots(content);
  return {
    robotsUrl,
    status: response.status,
    exists: true,
    content,
    crawlers: AI_CRAWLERS.map((crawler) => evaluateCrawler(groups, crawler)),
  };
}
