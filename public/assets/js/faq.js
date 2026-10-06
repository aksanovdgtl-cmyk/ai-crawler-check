const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const labels = { allowed: 'Разрешен', blocked: 'Заблокирован', partial: 'Частично' };
const purposeOrder = ['AI-поиск', 'Запрос пользователя', 'Обучение', 'Gemini и обучение'];

function normalizeUrl(value) {
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  return new URL(candidate).origin;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('aic-is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('aic-is-visible'), 1800);
}

function renderGroups(crawlers) {
  const companies = [...new Set(crawlers.map((item) => item.company))];
  $('#crawler-groups').innerHTML = companies.map((company) => {
    const items = crawlers.filter((item) => item.company === company).sort((a, b) => purposeOrder.indexOf(a.purpose) - purposeOrder.indexOf(b.purpose));
    return `<article class="aic-ac-group"><div class="aic-ac-group-head"><h3>${escapeHtml(company)}</h3><span>${items.length} ${items.length === 1 ? 'правило' : 'правила'}</span></div>${items.map((item) => `
      <div class="aic-ac-crawler-row"> <div class="aic-ac-crawler-name"><strong>${escapeHtml(item.agent)}</strong><small>Правило: ${escapeHtml(item.source)}</small></div> <div class="aic-ac-purpose">${escapeHtml(item.purpose)}</div> <span class="aic-ac-state ${item.state === 'blocked' ? 'aic-is-blocked' : item.state === 'partial' ? 'aic-is-partial' : ''}">${labels[item.state]}</span> <div class="aic-ac-rule">${escapeHtml(item.rule)}</div> </div>`).join('')}</article>`;
  }).join('');
}

function renderResult(data, origin) {
  const allowed = data.crawlers.filter((item) => item.state === 'allowed').length;
  const blocked = data.crawlers.filter((item) => item.state === 'blocked').length;
  const partial = data.crawlers.filter((item) => item.state === 'partial').length;
  $('#result-domain').textContent = new URL(origin).hostname;
  $('#allowed-count').textContent = allowed;
  $('#robots-link').href = data.robotsUrl;
  const summary = $('#summary');
  summary.querySelector('.aic-ac-summary-status').textContent = data.exists ? `robots.txt · ${data.status}` : 'Файл не найден';
  summary.querySelector('p').textContent = data.exists
    ? `${allowed} разрешены, ${partial} имеют частичный доступ, ${blocked} заблокированы.`
    : 'robots.txt отсутствует: доступ считается разрешенным по умолчанию, но CDN или firewall могут блокировать ботов отдельно.';
  renderGroups(data.crawlers);
}

$('#crawler-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('button[type="submit"]', event.currentTarget);
  $('#result').hidden = false;
  $('#result-domain').textContent = 'Проверяем сайт';
  $('#allowed-count').textContent = '…';
  $('#crawler-groups').innerHTML = '';
  $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const origin = normalizeUrl($('#site-url').value);
    button.disabled = true;
    button.textContent = 'Проверяем…';
    const response = await fetch(`/api/tools/ai-crawlers?url=${encodeURIComponent(origin)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось проверить сайт');
    renderResult(data, origin);
  } catch (error) {
    $('#result-domain').textContent = 'Проверка не выполнена';
    $('#allowed-count').textContent = '-';
    $('#summary').querySelector('.aic-ac-summary-status').textContent = 'Ошибка';
    $('#summary').querySelector('p').textContent = error.message;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Проверить <span aria-hidden="true">↗</span>';
  }
});

$('#copy-rule').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('#rule-code').textContent);
  showToast('Правило скопировано');
});
