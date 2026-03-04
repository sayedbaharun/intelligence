const REDIS_OP_TIMEOUT_MS = 8_000;
const REDIS_SCAN_TIMEOUT_MS = 8_000;
const REDIS_DEFAULT_SCAN_COUNT = 200;
const REDIS_DEFAULT_SCAN_ITERATIONS = 8;
const TELEGRAM_MAX_MESSAGE_CHARS = 4096;
const TELEGRAM_CHUNK_TARGET = 3800;

function getRedisCredentials() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

function getKeyPrefix() {
  const env = process.env.VERCEL_ENV;
  if (!env || env === 'production') return '';
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'dev';
  return `${env}:${sha}:`;
}

const cachedPrefix = getKeyPrefix();

function prefixedKey(key) {
  return cachedPrefix ? `${cachedPrefix}${key}` : key;
}

function candidateKeys(key, rawOnly) {
  if (rawOnly || !cachedPrefix) return [key];
  return [prefixedKey(key), key];
}

function parseJsonString(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildRedisHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function toHourBucketKey(date = new Date()) {
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}`;
}

export function parseHourBucketKeyFromRedisKey(key, expectedPrefix) {
  if (!key || !expectedPrefix) return null;
  if (!key.startsWith(`${expectedPrefix}:`)) return null;
  const suffix = key.slice(expectedPrefix.length + 1);
  const match = suffix.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const ms = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    0,
    0,
    0,
  );
  if (!Number.isFinite(ms)) return null;
  return { hourKey: suffix, timestampMs: ms };
}

export function formatUtcTimestamp(date = new Date()) {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function formatDubaiTimestamp(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date).replace(',', '');
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export async function redisGetJson(key, options = {}) {
  const { rawOnly = false } = options;
  const redis = getRedisCredentials();
  if (!redis) return null;

  for (const candidate of candidateKeys(key, rawOnly)) {
    try {
      const resp = await fetch(`${redis.url}/get/${encodeURIComponent(candidate)}`, {
        headers: { Authorization: `Bearer ${redis.token}` },
        signal: AbortSignal.timeout(REDIS_OP_TIMEOUT_MS),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (!data?.result) continue;
      const parsed = parseJsonString(data.result);
      if (parsed !== null) return parsed;
    } catch {
      // ignore and try next key variant
    }
  }
  return null;
}

export async function redisSetJson(key, value, options = {}) {
  const { ttlSeconds = null, rawOnly = false } = options;
  const redis = getRedisCredentials();
  if (!redis) return false;

  const finalKey = rawOnly ? key : prefixedKey(key);
  const command = ['SET', finalKey, JSON.stringify(value)];
  if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
    command.push('EX', String(Math.floor(ttlSeconds)));
  }

  try {
    const resp = await fetch(`${redis.url}`, {
      method: 'POST',
      headers: buildRedisHeaders(redis.token),
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(REDIS_OP_TIMEOUT_MS),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    return data?.result === 'OK';
  } catch {
    return false;
  }
}

export async function redisScanKeys(pattern, options = {}) {
  const {
    rawOnly = false,
    maxIterations = REDIS_DEFAULT_SCAN_ITERATIONS,
    count = REDIS_DEFAULT_SCAN_COUNT,
  } = options;
  const redis = getRedisCredentials();
  if (!redis) return [];

  const keys = new Set();
  let cursor = '0';
  const scanPattern = rawOnly ? pattern : prefixedKey(pattern);

  for (let i = 0; i < maxIterations; i++) {
    try {
      const url = `${redis.url}/scan/${encodeURIComponent(cursor)}/MATCH/${encodeURIComponent(scanPattern)}/COUNT/${count}`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${redis.token}` },
        signal: AbortSignal.timeout(REDIS_SCAN_TIMEOUT_MS),
      });
      if (!resp.ok) break;
      const data = await resp.json();
      const [nextCursor, batch] = data?.result || [];
      if (Array.isArray(batch)) {
        for (const key of batch) {
          if (typeof key !== 'string') continue;
          if (!rawOnly && cachedPrefix && key.startsWith(cachedPrefix)) {
            keys.add(key.slice(cachedPrefix.length));
          } else {
            keys.add(key);
          }
        }
      }
      cursor = String(nextCursor || '0');
      if (cursor === '0') break;
    } catch {
      break;
    }
  }

  return [...keys];
}

export async function redisGetJsonBatch(keys, options = {}) {
  const out = new Map();
  await Promise.all(keys.map(async (key) => {
    const value = await redisGetJson(key, options);
    out.set(key, value);
  }));
  return out;
}

export function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function matchesAnyKeyword(text, keywords) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

export function dedupeNewsItems(items) {
  const seen = new Set();
  const deduped = [];
  for (const item of items || []) {
    const title = String(item?.title || '').trim();
    const link = String(item?.link || '').trim();
    if (!title) continue;
    const key = `${title.toLowerCase()}|${link}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

export function collectDigestItems(digest) {
  const categories = digest?.categories;
  if (!categories || typeof categories !== 'object') return [];
  const out = [];

  for (const [categoryName, bucket] of Object.entries(categories)) {
    const rawItems = Array.isArray(bucket?.items) ? bucket.items : [];
    for (const item of rawItems) {
      const publishedAt = Number(item?.publishedAt || 0);
      const threatLevel = String(item?.threat?.level || item?.level || 'THREAT_LEVEL_UNSPECIFIED');
      out.push({
        source: String(item?.source || 'Unknown source'),
        title: String(item?.title || ''),
        link: String(item?.link || ''),
        publishedAt: Number.isFinite(publishedAt) && publishedAt > 0 ? publishedAt : Date.now(),
        isAlert: Boolean(item?.isAlert),
        threatLevel,
        threatCategory: String(item?.threat?.category || item?.category || categoryName || ''),
        confidence: Number(item?.threat?.confidence ?? item?.confidence ?? 0),
        category: String(categoryName || ''),
      });
    }
  }

  return dedupeNewsItems(out).sort((a, b) => b.publishedAt - a.publishedAt);
}

export function collectRssFeedItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  const items = [];
  for (const item of rawItems) {
    const publishedAt = Number(item?.publishedAt || 0);
    items.push({
      source: String(item?.source || 'Unknown source'),
      title: String(item?.title || ''),
      link: String(item?.link || ''),
      publishedAt: Number.isFinite(publishedAt) && publishedAt > 0 ? publishedAt : Date.now(),
      isAlert: Boolean(item?.isAlert),
      threatLevel: String(item?.level || 'THREAT_LEVEL_UNSPECIFIED'),
      threatCategory: String(item?.category || ''),
      confidence: Number(item?.confidence ?? 0),
      category: String(item?.category || ''),
    });
  }
  return dedupeNewsItems(items).sort((a, b) => b.publishedAt - a.publishedAt);
}

export function severityRank(level) {
  const normalized = normalizeText(level);
  if (normalized.includes('critical')) return 4;
  if (normalized.includes('high')) return 3;
  if (normalized.includes('medium')) return 2;
  if (normalized.includes('low')) return 1;
  return 0;
}

export function formatNewsBullet(item) {
  const ts = new Date(item.publishedAt);
  const datePart = Number.isFinite(ts.getTime()) ? ts.toISOString().slice(11, 16) : '--:--';
  const lvl = String(item.threatLevel || 'THREAT_LEVEL_UNSPECIFIED')
    .replace('THREAT_LEVEL_', '')
    .toUpperCase();
  return `- [${lvl}] ${item.title} (${item.source}, ${datePart} UTC)`;
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function chunkByLines(text, maxChars) {
  const chunks = [];
  let rest = String(text || '').trim();
  while (rest.length > 0) {
    if (rest.length <= maxChars) {
      chunks.push(rest);
      break;
    }

    let sliceAt = rest.lastIndexOf('\n\n', maxChars);
    if (sliceAt < Math.floor(maxChars * 0.55)) {
      sliceAt = rest.lastIndexOf('\n', maxChars);
    }
    if (sliceAt < Math.floor(maxChars * 0.4)) {
      sliceAt = maxChars;
    }

    const chunk = rest.slice(0, sliceAt).trim();
    if (chunk.length === 0) {
      const hard = rest.slice(0, maxChars).trim();
      chunks.push(hard);
      rest = rest.slice(maxChars).trim();
      continue;
    }

    chunks.push(chunk);
    rest = rest.slice(sliceAt).trim();
  }
  return chunks;
}

export async function sendTelegramText(botToken, chatId, text) {
  if (!botToken || !chatId || !text) {
    return {
      ok: false,
      sent: 0,
      error: 'Missing TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, or text',
    };
  }

  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const rawChunks = chunkByLines(text, TELEGRAM_CHUNK_TARGET);
  const chunks = [];

  for (const rawChunk of rawChunks) {
    let chunk = rawChunk;
    while (chunk.length > 0) {
      const escaped = escapeHtml(chunk);
      if (escaped.length <= TELEGRAM_MAX_MESSAGE_CHARS) {
        chunks.push(chunk);
        break;
      }
      const shortened = chunk.slice(0, Math.max(1200, Math.floor(chunk.length * 0.8))).trim();
      if (shortened.length >= chunk.length) break;
      chunk = shortened;
    }
  }

  let sent = 0;
  for (const chunk of chunks) {
    const payload = {
      chat_id: chatId,
      text: escapeHtml(chunk),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) {
        const body = await resp.text();
        return { ok: false, sent, error: `Telegram HTTP ${resp.status}: ${body.slice(0, 300)}` };
      }
      sent += 1;
    } catch (err) {
      return { ok: false, sent, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return { ok: true, sent, error: '' };
}

export async function findLatestRedisKeyWithPrefix(prefix) {
  const keys = await redisScanKeys(`${prefix}:*`, { rawOnly: true, maxIterations: 12, count: 300 });
  let latestKey = null;
  let latestTs = -Infinity;
  for (const key of keys) {
    const parsed = parseHourBucketKeyFromRedisKey(key, prefix);
    if (!parsed) continue;
    if (parsed.timestampMs > latestTs) {
      latestTs = parsed.timestampMs;
      latestKey = key;
    }
  }
  return latestKey;
}
