# AI Crawler Access Checker

**Проверка доступа AI-краулеров** · [English](#english) · [Русский](#русский)

[![test](https://github.com/aksanovdgtl-cmyk/ai-crawler-check/actions/workflows/test.yml/badge.svg)](https://github.com/aksanovdgtl-cmyk/ai-crawler-check/actions/workflows/test.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-22f360.svg)](LICENSE) [![Live tool](https://img.shields.io/badge/live-hitz.agency-232323.svg)](https://hitz.agency/en/tools/ai-crawler-check)

## English

Check which AI crawlers a website lets in through robots.txt. The tool reads the site's robots.txt and reports access for 9 crawlers from OpenAI, Anthropic, Perplexity and Google, split by purpose: AI search, user-initiated fetch and model training.

- **Live tool:** [hitz.agency/en/tools/ai-crawler-check](https://hitz.agency/en/tools/ai-crawler-check) (Russian: [hitz.agency/tools/ai-crawler-check](https://hitz.agency/tools/ai-crawler-check))
- **This repository:** the same page and the same server check that run on hitz.agency, ready to self-host on Cloudflare Workers.

### Crawlers checked

| User agent | Company | Purpose |
|---|---|---|
| `OAI-SearchBot` | OpenAI | AI search (ChatGPT search results) |
| `GPTBot` | OpenAI | Model training |
| `ChatGPT-User` | OpenAI | Fetch on a user's request |
| `Claude-SearchBot` | Anthropic | AI search |
| `ClaudeBot` | Anthropic | Model training |
| `Claude-User` | Anthropic | Fetch on a user's request |
| `PerplexityBot` | Perplexity | AI search |
| `Perplexity-User` | Perplexity | Fetch on a user's request |
| `Google-Extended` | Google | Gemini and training (a robots.txt control token, not a separate crawler) |

Official documentation: [OpenAI](https://platform.openai.com/docs/bots), [Anthropic](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), [Perplexity](https://docs.perplexity.ai/guides/bots), [Google](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers). robots.txt syntax: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309).

### How the result is calculated

1. The Worker loads `https://<domain>/robots.txt`; the path, query and hash of the entered URL are dropped. It follows up to 3 redirects, each to a public address, waits up to 10 seconds and rejects files over 200 KB.
2. If robots.txt returns 404, every crawler is allowed by default. Other error codes are reported as errors.
3. Rules are grouped by `User-agent`. A crawler uses its own group when one exists (several groups for the same agent are merged), otherwise the `User-agent: *` group.
4. The state comes from the rules of that group:
   - `blocked`: the longest rule that matches the site root `/` is `Disallow` (on equal length `Allow` wins);
   - `partial`: the root is not blocked, but the group has at least one non-empty `Disallow`;
   - `allowed`: there are no restricting rules.
5. Each crawler row returns the rule that decided the state and where it came from: the crawler's own group, `*`, or the default.

The check reads robots.txt only. Bot protection in Cloudflare, a WAF or a firewall can still block a crawler that robots.txt allows.

### API

```http
GET /api/tools/ai-crawlers?url=https://example.com
```

```json
{
  "robotsUrl": "https://example.com/robots.txt",
  "status": 200,
  "exists": true,
  "content": "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\n",
  "crawlers": [
    { "agent": "OAI-SearchBot", "company": "OpenAI", "purpose": "AI-поиск", "state": "partial", "source": "*", "rule": "Disallow: /admin" },
    { "agent": "GPTBot", "company": "OpenAI", "purpose": "Обучение", "state": "blocked", "source": "GPTBot", "rule": "Disallow: /" }
  ]
}
```

`crawlers` always has 9 items in the order of the table above. `purpose` and messages are in Russian, as on hitz.agency; the English page translates them in the browser. Add `lang=en` to get error messages in English.

| Status | When |
|---|---|
| 400 | no `url`; not http(s); login or password in the URL; non-standard port; IP address, localhost or a host that resolves to a private network; robots.txt over 200 KB |
| 403 | browser request from another origin |
| 429 | more than 10 requests per minute from one IP, or 300 in total |
| 502 | robots.txt returned an error code, timed out or redirected too many times |

### Safety

The Worker fetches public websites only. Before every request, including each redirect, the hostname is resolved through DNS over HTTPS and rejected if it points to a private, loopback, link-local or reserved address. Requests go out with the `HITZ-AI-crawler-check/1.0` user agent; change it in `src/core/net.ts` if you deploy your own copy.

### Related guides (in Russian)

- [AI-краулеры и robots.txt: каких ботов пускать на сайт](https://hitz.agency/blog/ai-kraulery-robots-txt)
- [Сайт на JavaScript: почему нейросети не видят контент](https://hitz.agency/blog/sayt-na-javascript-i-neyroseti)

### Run locally

Requires Node.js 22.18 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:8787 for the Russian interface or http://localhost:8787/en/ for English. The page calls the API on the same origin: `GET /api/tools/ai-crawlers`.

### Deploy to Cloudflare Workers

```sh
npx wrangler login
npm run deploy
```

One Worker serves `public/` as static assets and answers `/api/tools/ai-crawlers`. The free Workers plan is enough. HTML is parsed with [HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/), which is built into the Workers runtime.

### Tests

`npm test` runs unit tests and API tests. API tests build the Worker with Wrangler and run it in Miniflare, the local Cloudflare runtime. DNS lookups and site responses come from fixtures, so no request leaves your machine. `npm run check` type-checks the TypeScript.

### Project structure

```text
public/              page (Russian at /, English at /en/), styles, scripts, fonts
src/worker.ts        Worker entry: /api/* goes to the API, everything else to static assets
src/api.ts           route, Origin check, rate limit, error messages
src/core/            the checks themselves (net.ts, robots.ts)
test/                unit tests and API tests in Miniflare
provenance.json      where each file comes from on hitz.agency, with checksums
CITATION.cff         citation metadata
```

### More free GEO tools by HITZ

| Tool | Live version | Source |
|---|---|---|
| llms.txt Checker and Generator | [hitz.agency/en/tools/llms-txt](https://hitz.agency/en/tools/llms-txt) | [llms-txt-generator](https://github.com/aksanovdgtl-cmyk/llms-txt-generator) |
| Prompt Map Generator | [hitz.agency/en/tools/prompt-map](https://hitz.agency/en/tools/prompt-map) | [geo-prompt-map](https://github.com/aksanovdgtl-cmyk/geo-prompt-map) |
| GEO Page Audit | [hitz.agency/en/tools/geo-audit](https://hitz.agency/en/tools/geo-audit) | [geo-audit](https://github.com/aksanovdgtl-cmyk/geo-audit) |
| Brand Entity Check | [hitz.agency/en/tools/brand-entity](https://hitz.agency/en/tools/brand-entity) | [brand-entity-check](https://github.com/aksanovdgtl-cmyk/brand-entity-check) |
| Schema / JSON-LD Checker | [hitz.agency/en/tools/schema-check](https://hitz.agency/en/tools/schema-check) | [jsonld-schema-check](https://github.com/aksanovdgtl-cmyk/jsonld-schema-check) |

Catalog with guides: [hitz-geo-tools](https://github.com/aksanovdgtl-cmyk/hitz-geo-tools) · [hitz.agency/en/tools](https://hitz.agency/en/tools)

### How to cite

Use **Cite this repository** on GitHub ([CITATION.cff](CITATION.cff)) or:

> HITZ. AI Crawler Access Checker. https://hitz.agency/en/tools/ai-crawler-check

A link to the live tool is appreciated when you mention it in an article or a talk. The MIT license only requires keeping the copyright notice in copies of the code.

### About HITZ

[HITZ](https://hitz.agency/en) is a GEO agency based in Almaty and Tashkent. We help brands get mentioned and cited in answers from ChatGPT, Gemini, Perplexity, Claude, Google AI Overviews and Yandex Alice. This tool is part of our free [GEO toolkit](https://hitz.agency/en/tools).

### License

[MIT](LICENSE) © 2026 HITZ. The fonts in `public/assets/fonts` are under the SIL Open Font License 1.1. The HITZ name and logo are not covered by the MIT license.

---

## Русский

Проверка того, каких AI-краулеров пускает сайт по правилам robots.txt. Инструмент читает robots.txt и показывает доступ для 9 ботов OpenAI, Anthropic, Perplexity и Google с разбивкой по задачам: AI-поиск, запрос пользователя, обучение моделей.

- **Онлайн-версия:** [hitz.agency/tools/ai-crawler-check](https://hitz.agency/tools/ai-crawler-check) (английская: [hitz.agency/en/tools/ai-crawler-check](https://hitz.agency/en/tools/ai-crawler-check))
- **Этот репозиторий:** та же страница и та же серверная проверка, что работают на hitz.agency. Можно развернуть у себя в Cloudflare Workers.

### Какие боты проверяются

| User agent | Компания | Задача |
|---|---|---|
| `OAI-SearchBot` | OpenAI | AI-поиск (результаты поиска ChatGPT) |
| `GPTBot` | OpenAI | Обучение моделей |
| `ChatGPT-User` | OpenAI | Загрузка страницы по запросу пользователя |
| `Claude-SearchBot` | Anthropic | AI-поиск |
| `ClaudeBot` | Anthropic | Обучение моделей |
| `Claude-User` | Anthropic | Загрузка страницы по запросу пользователя |
| `PerplexityBot` | Perplexity | AI-поиск |
| `Perplexity-User` | Perplexity | Загрузка страницы по запросу пользователя |
| `Google-Extended` | Google | Gemini и обучение (управляющий токен robots.txt, а не отдельный краулер) |

Документация компаний: [OpenAI](https://platform.openai.com/docs/bots), [Anthropic](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), [Perplexity](https://docs.perplexity.ai/guides/bots), [Google](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers). Синтаксис robots.txt: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309).

### Как считается результат

1. Worker загружает `https://<домен>/robots.txt`, путь, параметры и якорь введенного адреса отбрасываются. До 3 перенаправлений, каждое только на публичный адрес, ожидание до 10 секунд, файлы больше 200 КБ не принимаются.
2. Если robots.txt отвечает 404, всем ботам доступ открыт по умолчанию. Другие коды ошибок возвращаются как ошибка.
3. Правила собираются в группы по `User-agent`. Бот берет свою группу, если она есть (несколько групп одного бота объединяются), иначе группу `User-agent: *`.
4. Состояние определяют правила этой группы:
   - `blocked` (заблокирован): самое длинное правило для корня сайта `/` это `Disallow` (при равной длине побеждает `Allow`);
   - `partial` (частичный доступ): корень открыт, но в группе есть хотя бы один непустой `Disallow`;
   - `allowed` (разрешен): запрещающих правил нет.
5. Для каждого бота возвращается правило, которое определило состояние, и его источник: своя группа, `*` или доступ по умолчанию.

Проверка читает только robots.txt. Защита от ботов в Cloudflare, WAF или файрвол могут закрыть доступ боту, которому robots.txt его открывает.

### API

```http
GET /api/tools/ai-crawlers?url=https://example.com
```

Ответ: адрес robots.txt, код ответа, признак наличия файла, его текст и массив `crawlers` из 9 ботов в порядке таблицы выше (пример ответа в английском разделе). Поля `state`: `allowed`, `partial`, `blocked`. С параметром `lang=en` ошибки приходят по-английски.

| Код | Когда |
|---|---|
| 400 | нет `url`; не http(s); логин или пароль в адресе; нестандартный порт; IP-адрес, localhost или имя, которое указывает во внутреннюю сеть; robots.txt больше 200 КБ |
| 403 | запрос браузера с чужого домена |
| 429 | больше 10 запросов в минуту с одного IP или 300 на всех |
| 502 | robots.txt ответил кодом ошибки, не ответил вовремя или перенаправлений слишком много |

### Безопасность

Worker загружает только публичные сайты. Перед каждым запросом, включая перенаправления, имя сайта проверяется через DNS over HTTPS: если оно указывает на частный, локальный, служебный или зарезервированный адрес, запрос не выполняется. User agent запросов: `HITZ-AI-crawler-check/1.0`; для своей копии его можно сменить в `src/core/net.ts`.

### Разборы по теме

- [AI-краулеры и robots.txt: каких ботов пускать на сайт](https://hitz.agency/blog/ai-kraulery-robots-txt)
- [Сайт на JavaScript: почему нейросети не видят контент](https://hitz.agency/blog/sayt-na-javascript-i-neyroseti)

### Запуск

Нужен Node.js 22.18 или новее.

```sh
npm install
npm run dev
```

Откройте http://localhost:8787 (русский интерфейс) или http://localhost:8787/en/ (английский). Страница обращается к API на своем домене: `GET /api/tools/ai-crawlers`.

### Публикация в Cloudflare Workers

```sh
npx wrangler login
npm run deploy
```

Один Worker отдает статику из `public/` и отвечает на `/api/tools/ai-crawlers`. Бесплатного тарифа Workers достаточно. HTML разбирается через [HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/), он встроен в среду Workers.

### Проверки

`npm test` запускает модульные тесты и тесты API. Для тестов API Worker собирается Wrangler и работает в Miniflare, локальной среде Cloudflare. DNS и ответы сайтов подставляются из фикстур: запросы в интернет не уходят. `npm run check` проверяет типы TypeScript.

### Структура

```text
public/              страница (русская на /, английская на /en/), стили, скрипты, шрифты
src/worker.ts        вход Worker: /api/* в API, остальное в статику
src/api.ts           маршрут, проверка Origin, лимит запросов, тексты ошибок
src/core/            сами проверки (net.ts, robots.ts)
test/                модульные тесты и тесты API в Miniflare
provenance.json      откуда взят каждый файл на hitz.agency, контрольные суммы
CITATION.cff         данные для цитирования
```

### Другие бесплатные инструменты HITZ

| Инструмент | Онлайн | Исходный код |
|---|---|---|
| Проверка и генератор llms.txt | [hitz.agency/tools/llms-txt](https://hitz.agency/tools/llms-txt) | [llms-txt-generator](https://github.com/aksanovdgtl-cmyk/llms-txt-generator) |
| Генератор карты промтов | [hitz.agency/tools/prompt-map](https://hitz.agency/tools/prompt-map) | [geo-prompt-map](https://github.com/aksanovdgtl-cmyk/geo-prompt-map) |
| GEO-аудит страницы | [hitz.agency/tools/geo-audit](https://hitz.agency/tools/geo-audit) | [geo-audit](https://github.com/aksanovdgtl-cmyk/geo-audit) |
| Проверка сущности бренда | [hitz.agency/tools/brand-entity](https://hitz.agency/tools/brand-entity) | [brand-entity-check](https://github.com/aksanovdgtl-cmyk/brand-entity-check) |
| Проверка и генератор Schema / JSON-LD | [hitz.agency/tools/schema-check](https://hitz.agency/tools/schema-check) | [jsonld-schema-check](https://github.com/aksanovdgtl-cmyk/jsonld-schema-check) |

Каталог с разборами: [hitz-geo-tools](https://github.com/aksanovdgtl-cmyk/hitz-geo-tools) · [hitz.agency/tools](https://hitz.agency/tools)

### Как сослаться

Кнопка GitHub **Cite this repository** ([CITATION.cff](CITATION.cff)) или строка:

> HITZ. Проверка доступа AI-краулеров. https://hitz.agency/tools/ai-crawler-check

Если упоминаете инструмент в статье или докладе, будем рады ссылке на онлайн-версию. Лицензия MIT требует только сохранить уведомление об авторстве в копиях кода.

### О HITZ

[HITZ](https://hitz.agency/) - GEO-агентство из Алматы и Ташкента. Помогаем брендам попадать в ответы ChatGPT, Gemini, Perplexity, Claude, Google AI Overviews и Алисы. Инструмент входит в набор [бесплатных GEO-инструментов](https://hitz.agency/tools).

### Лицензия

[MIT](LICENSE) © 2026 HITZ. Шрифты в `public/assets/fonts` распространяются по SIL Open Font License 1.1. Название и логотип HITZ под лицензию MIT не подпадают.
