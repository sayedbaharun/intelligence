import {
  collectDigestItems,
  collectRssFeedItems,
  dedupeNewsItems,
  findLatestRedisKeyWithPrefix,
  formatNewsBullet,
  formatUtcTimestamp,
  jsonResponse,
  matchesAnyKeyword,
  redisGetJson,
  redisGetJsonBatch,
  redisScanKeys,
  redisSetJson,
  severityRank,
  toHourBucketKey,
} from './_shared.js';

export const config = { runtime: 'edge' };

const RAW_KEY_PREFIX = 'briefing:raw';
const RAW_TTL_SECONDS = 48 * 60 * 60;

const WAR_SECURITY_KEYWORDS = [
  'war', 'conflict', 'military', 'strike', 'missile', 'drone', 'navy', 'army', 'idf',
  'houthi', 'hormuz', 'red sea', 'gulf', 'iran', 'israel', 'ukraine', 'russia',
];
const DUBAI_RE_KEYWORDS = [
  'dubai', 'uae', 'abu dhabi', 'property', 'real estate', 'off-plan', 'mortgage', 'villa', 'apartment',
];
const DUBAI_REGULATORY_KEYWORDS = [
  'rera', 'dld', 'regulation', 'law', 'decree', 'visa', 'golden visa', 'mortgage', 'escrow', 'off-plan',
];
const AI_KEYWORDS = [
  'ai', 'artificial intelligence', 'llm', 'gpt', 'claude', 'gemini', 'mistral', 'llama', 'model', 'agent',
];
const AI_RELEASE_KEYWORDS = ['release', 'launch', 'new model', 'version', 'update', 'api', 'pricing'];
const AI_VENDOR_KEYWORDS = ['openai', 'anthropic', 'google', 'meta', 'mistral'];
const AIRSPACE_KEYWORDS = ['airspace closed', 'airspace restricted', 'flight suspended', 'airport closed'];
const AIRSPACE_REGION_KEYWORDS = ['uae', 'dubai', 'gulf', 'abu dhabi', 'hormuz', 'jebel ali'];
const GULF_CONFLICT_KEYWORDS = ['dubai', 'uae', 'gulf', 'hormuz', 'abu dhabi', 'jebel ali'];

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pct(value) {
  const n = toFiniteNumber(value);
  if (n === null) return 'N/A';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function usd(value) {
  const n = toFiniteNumber(value);
  return n === null ? 'N/A' : `$${n.toFixed(2)}`;
}

function formatItemTimestamp(ms) {
  const d = new Date(Number(ms) || Date.now());
  return Number.isFinite(d.getTime()) ? `${d.toISOString().slice(11, 16)} UTC` : 'Unknown time';
}

function parseQuotes(payload) {
  if (Array.isArray(payload?.quotes)) return payload.quotes;
  if (Array.isArray(payload?.data?.quotes)) return payload.data.quotes;
  return [];
}

function parseEnergyPrices(payload) {
  if (Array.isArray(payload?.prices)) return payload.prices;
  if (Array.isArray(payload?.data?.prices)) return payload.data.prices;
  return [];
}

function parseRiskScores(payload) {
  if (!payload || typeof payload !== 'object') return { ciiScores: [], strategicRisks: [] };
  return {
    ciiScores: Array.isArray(payload?.ciiScores) ? payload.ciiScores : [],
    strategicRisks: Array.isArray(payload?.strategicRisks) ? payload.strategicRisks : [],
  };
}

function byPublishedAtDesc(items) {
  return [...items].sort((a, b) => Number(b?.publishedAt || 0) - Number(a?.publishedAt || 0));
}

function topSeverityThenRecency(items, limit) {
  return [...items]
    .sort((a, b) => {
      const rankDiff = severityRank(b?.threatLevel) - severityRank(a?.threatLevel);
      if (rankDiff !== 0) return rankDiff;
      return Number(b?.publishedAt || 0) - Number(a?.publishedAt || 0);
    })
    .slice(0, limit);
}

function extractTopNewsByKeywords(items, keywords, limit) {
  return byPublishedAtDesc(items.filter((item) => matchesAnyKeyword(item?.title, keywords))).slice(0, limit);
}

function quoteBySymbol(quotes, symbol) {
  return quotes.find((q) => String(q?.symbol || '').toUpperCase() === symbol.toUpperCase()) || null;
}

function energyByCommodity(prices, commodity) {
  return prices.find((p) => String(p?.commodity || '').toLowerCase() === commodity.toLowerCase()) || null;
}

function parseVixFromMacro(macroSignals) {
  const val = toFiniteNumber(macroSignals?.signals?.fearGreed?.value);
  return val;
}

function buildBusinessSignals({
  allNews,
  aiNews,
  dubaiNews,
  dubaiRegulatory,
  brentPrice,
  goldSilverRatio,
  vixValue,
  btcChange,
}) {
  const alerts = [];
  const now = Date.now();

  if (brentPrice !== null && brentPrice > 90) {
    alerts.push({
      ts: now,
      tone: 'market',
      title: '🛢️ Oil above $90 — Energy costs rising',
      businesses: [
        'Aivant Realty: Construction costs may increase. Watch developer margins.',
        'ArabMoney: Content opportunity — oil price impact explainer',
      ],
      action: 'Review cost assumptions and publish oil-impact content.',
    });
  }

  if (goldSilverRatio !== null && goldSilverRatio > 85) {
    alerts.push({
      ts: now,
      tone: 'market',
      title: '⚪ Gold-Silver ratio above 85 — Silver historically undervalued',
      businesses: ['Trading: Consider adding to XAGUSD long position'],
      action: 'Re-check entry levels and risk sizing for silver longs.',
    });
  }

  const gulfConflict = byPublishedAtDesc(allNews).find((item) => {
    const highSeverity = severityRank(item?.threatLevel) >= 3 || item?.isAlert || matchesAnyKeyword(item?.title, ['breaking']);
    return highSeverity && matchesAnyKeyword(item?.title, GULF_CONFLICT_KEYWORDS);
  });
  if (gulfConflict) {
    alerts.push({
      ts: Number(gulfConflict.publishedAt) || now,
      tone: 'critical',
      title: '🔴 Gulf conflict signal detected',
      businesses: [
        'MyDub.ai: Breaking news content opportunity — publish immediately',
        'Aivant Realty: Monitor buyer sentiment impact',
        'All ventures: Check physical infrastructure and travel status',
      ],
      action: `Act on ${gulfConflict.source} headline: "${gulfConflict.title}".`,
    });
  }

  const aiRelease = byPublishedAtDesc(aiNews).find((item) =>
    matchesAnyKeyword(item?.title, AI_RELEASE_KEYWORDS)
    && matchesAnyKeyword(item?.title, AI_VENDOR_KEYWORDS));
  if (aiRelease) {
    alerts.push({
      ts: Number(aiRelease.publishedAt) || now,
      tone: 'opportunity',
      title: '🤖 Major AI model release detected',
      businesses: [
        'Hikma Digital: Evaluate for client automation offerings',
        'OpenClaw: Check if new model should be integrated',
      ],
      action: `Evaluate release headline: "${aiRelease.title}".`,
    });
  }

  if (vixValue !== null && vixValue > 25) {
    alerts.push({
      ts: now,
      tone: 'market',
      title: '📉 High market volatility (VIX > 25)',
      businesses: [
        'ArabMoney: Volatility content — fear/greed explainer',
        'Trading: Heightened risk, tighten stops',
      ],
      action: 'Tighten risk controls across active positions.',
    });
  }

  if (btcChange !== null && btcChange > 5) {
    alerts.push({
      ts: now,
      tone: 'opportunity',
      title: '₿ Bitcoin moving significantly (+5%+ in 24h)',
      businesses: ['ArabMoney: Crypto content opportunity'],
      action: 'Ship crypto momentum explainer with near-term scenarios.',
    });
  }

  const dubaiReg = byPublishedAtDesc(dubaiRegulatory)[0];
  if (dubaiReg) {
    alerts.push({
      ts: Number(dubaiReg.publishedAt) || now,
      tone: 'regulatory',
      title: '📋 Dubai regulatory update detected',
      businesses: [
        'Aivant Realty: Review for client impact',
        'Hikma Digital: Check if regulation affects AI/tech clients',
      ],
      action: `Review regulatory headline: "${dubaiReg.title}".`,
    });
  }

  const airspaceSignal = byPublishedAtDesc([...allNews, ...dubaiNews, ...aiNews]).find((item) =>
    matchesAnyKeyword(item?.title, AIRSPACE_KEYWORDS)
    && matchesAnyKeyword(item?.title, AIRSPACE_REGION_KEYWORDS));
  if (airspaceSignal) {
    alerts.push({
      ts: Number(airspaceSignal.publishedAt) || now,
      tone: 'critical',
      title: '✈️ Gulf airspace/airport disruption',
      businesses: [
        'All ventures: Check travel plans',
        'MyDub.ai: Breaking travel advisory content',
      ],
      action: `Issue advisory based on "${airspaceSignal.title}".`,
    });
  }

  return alerts.sort((a, b) => b.ts - a.ts).slice(0, 20);
}

function buildMarkdown({
  gatheredAt,
  warSecurity,
  dubaiNews,
  dubaiRegulatory,
  aiNews,
  markets,
  metals,
  businessSignals,
  ciiScores,
  strategicRisks,
}) {
  const lines = [];
  lines.push(`# RAW INTELLIGENCE — ${formatUtcTimestamp(gatheredAt)}`);
  lines.push('');
  lines.push('## WAR & SECURITY');
  if (warSecurity.length === 0) {
    lines.push('- No conflict or military headlines in cached digest right now.');
  } else {
    for (const item of warSecurity.slice(0, 8)) lines.push(formatNewsBullet(item));
  }
  lines.push('');

  lines.push('## DUBAI REAL ESTATE');
  if (dubaiNews.length === 0) {
    lines.push('- No Dubai/UAE property headlines found in current Redis news cache.');
  } else {
    for (const item of dubaiNews.slice(0, 6)) lines.push(formatNewsBullet(item));
  }
  if (dubaiRegulatory.length > 0) {
    lines.push(`- Regulatory alerts in cache: ${dubaiRegulatory.length}`);
    for (const item of dubaiRegulatory.slice(0, 3)) lines.push(`  - ${item.title} (${item.source})`);
  } else {
    lines.push('- Regulatory alerts: none matched current keyword set.');
  }
  lines.push('');

  lines.push('## PRECIOUS METALS');
  lines.push(`- Gold (XAUUSD): ${usd(metals.goldPrice)} (${pct(metals.goldChange24h)} 24h)`);
  lines.push(`- Silver (XAGUSD): ${usd(metals.silverPrice)} (${pct(metals.silverChange24h)} 24h)`);
  lines.push(`- Gold-Silver Ratio: ${metals.ratio === null ? 'N/A' : metals.ratio.toFixed(2)}`);
  lines.push(`- Signal: ${metals.ratioSignal}`);
  lines.push('');

  lines.push('## AI & TECH');
  if (aiNews.length === 0) {
    lines.push('- No AI/tech headlines found in current Redis cache.');
  } else {
    for (const item of aiNews.slice(0, 8)) lines.push(formatNewsBullet(item));
  }
  lines.push('');

  lines.push('## MARKETS');
  lines.push(`- Brent: ${usd(markets.brentPrice)} (${pct(markets.brentChange)}).`);
  lines.push(`- WTI proxy (CL=F): ${usd(markets.wtiProxyPrice)} (${pct(markets.wtiProxyChange)}).`);
  lines.push(`- BTC: ${usd(markets.btcPrice)} (${pct(markets.btcChange)}).`);
  lines.push(`- VIX: ${markets.vixValue === null ? 'N/A' : markets.vixValue.toFixed(2)}.`);
  lines.push(`- S&P 500 (^GSPC): ${usd(markets.spxPrice)} (${pct(markets.spxChange)}).`);
  if (strategicRisks.length > 0) {
    const sr = strategicRisks[0];
    lines.push(`- Strategic risk: ${String(sr.level || 'UNKNOWN').replace('SEVERITY_LEVEL_', '')} (${toFiniteNumber(sr.score)?.toFixed(0) || 'N/A'}).`);
  }
  if (ciiScores.length > 0) {
    const top = [...ciiScores]
      .sort((a, b) => toFiniteNumber(b?.combinedScore || 0) - toFiniteNumber(a?.combinedScore || 0))
      .slice(0, 3)
      .map((s) => `${s.region}:${toFiniteNumber(s.combinedScore)?.toFixed(0) || '0'}`)
      .join(', ');
    lines.push(`- Top CII regions: ${top}.`);
  }
  lines.push('');

  lines.push('## BUSINESS SIGNALS');
  if (businessSignals.length === 0) {
    lines.push('- All Clear: no business radar rules triggered from available cached data.');
  } else {
    for (const signal of businessSignals) {
      lines.push(`- ${signal.title} (${formatItemTimestamp(signal.ts)})`);
      for (const business of signal.businesses) lines.push(`  - ${business}`);
      lines.push(`  - Action: ${signal.action}`);
    }
  }
  lines.push('');

  return lines.join('\n').trim();
}

async function loadFallbackRssItems() {
  const keys = await redisScanKeys('rss:feed:v1:*', { rawOnly: true, maxIterations: 6, count: 150 });
  if (keys.length === 0) return [];
  const selected = keys.slice(0, 80);
  const results = await Promise.all(selected.map((key) => redisGetJson(key, { rawOnly: true })));
  const merged = [];
  for (const payload of results) {
    merged.push(...collectRssFeedItems(payload));
  }
  return byPublishedAtDesc(dedupeNewsItems(merged));
}

export default async function handler(req) {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const gatheredAt = new Date();
  const hourKey = toHourBucketKey(gatheredAt);
  const redisHourKey = `${RAW_KEY_PREFIX}:${hourKey}`;

  const keysToLoad = [
    'news:digest:v1:full:en',
    'news:digest:v1:tech:en',
    'news:digest:v1:finance:en',
    'market:stocks-bootstrap:v1',
    'market:commodities-bootstrap:v1',
    'market:crypto:v1',
    'economic:macro-signals:v1',
    'economic:energy:v1:all',
    'risk:scores:sebuf:stale:v1',
  ];

  const cacheMap = await redisGetJsonBatch(keysToLoad, { rawOnly: true });
  const fullDigestItems = collectDigestItems(cacheMap.get('news:digest:v1:full:en'));
  const techDigestItems = collectDigestItems(cacheMap.get('news:digest:v1:tech:en'));
  const financeDigestItems = collectDigestItems(cacheMap.get('news:digest:v1:finance:en'));

  let allNews = dedupeNewsItems([
    ...fullDigestItems,
    ...techDigestItems,
    ...financeDigestItems,
  ]);

  if (allNews.length === 0) {
    const fallbackItems = await loadFallbackRssItems();
    allNews = dedupeNewsItems(fallbackItems);
  }

  const commodityQuotes = parseQuotes(cacheMap.get('market:commodities-bootstrap:v1'));
  const stockQuotes = parseQuotes(cacheMap.get('market:stocks-bootstrap:v1'));
  const cryptoQuotes = parseQuotes(cacheMap.get('market:crypto:v1'));
  const macroSignals = cacheMap.get('economic:macro-signals:v1') || {};
  const energyPrices = parseEnergyPrices(cacheMap.get('economic:energy:v1:all'));
  const { ciiScores, strategicRisks } = parseRiskScores(cacheMap.get('risk:scores:sebuf:stale:v1'));

  const gold = quoteBySymbol(commodityQuotes, 'GC=F');
  const silver = quoteBySymbol(commodityQuotes, 'SI=F');
  const vix = quoteBySymbol(commodityQuotes, '^VIX');
  const cl = quoteBySymbol(commodityQuotes, 'CL=F');
  const spx = quoteBySymbol(stockQuotes, '^GSPC');
  const btc = cryptoQuotes.find((coin) => String(coin?.symbol || '').toUpperCase() === 'BTC') || null;
  const brent = energyByCommodity(energyPrices, 'brent');

  const ratio = (toFiniteNumber(gold?.price) !== null && toFiniteNumber(silver?.price) !== null && toFiniteNumber(silver?.price) !== 0)
    ? toFiniteNumber(gold.price) / toFiniteNumber(silver.price)
    : null;

  const metals = {
    goldPrice: toFiniteNumber(gold?.price),
    goldChange24h: toFiniteNumber(gold?.change),
    silverPrice: toFiniteNumber(silver?.price),
    silverChange24h: toFiniteNumber(silver?.change),
    ratio,
    ratioSignal: ratio === null
      ? 'No ratio available from cache'
      : ratio > 85
        ? 'Bullish silver skew (ratio > 85)'
        : ratio >= 75
          ? 'Neutral zone (ratio 75-85)'
          : 'Silver rich vs gold (ratio < 75)',
  };

  const warSecurity = topSeverityThenRecency(
    allNews.filter((item) =>
      matchesAnyKeyword(item?.title, WAR_SECURITY_KEYWORDS)
      || matchesAnyKeyword(item?.category, ['middleeast', 'crisis', 'conflict', 'military', 'intel', 'security'])),
    8,
  );

  const dubaiNews = extractTopNewsByKeywords(allNews, DUBAI_RE_KEYWORDS, 8);
  const dubaiRegulatory = dubaiNews.filter((item) => matchesAnyKeyword(item?.title, DUBAI_REGULATORY_KEYWORDS));
  const aiNews = byPublishedAtDesc(allNews.filter((item) =>
    matchesAnyKeyword(item?.title, AI_KEYWORDS)
    || matchesAnyKeyword(item?.category, ['ai', 'tech', 'startups', 'policy', 'funding']))).slice(0, 12);

  const markets = {
    brentPrice: toFiniteNumber(brent?.price),
    brentChange: toFiniteNumber(brent?.change),
    wtiProxyPrice: toFiniteNumber(cl?.price),
    wtiProxyChange: toFiniteNumber(cl?.change),
    btcPrice: toFiniteNumber(btc?.price),
    btcChange: toFiniteNumber(btc?.change),
    vixValue: toFiniteNumber(vix?.price) ?? parseVixFromMacro(macroSignals),
    spxPrice: toFiniteNumber(spx?.price),
    spxChange: toFiniteNumber(spx?.change),
  };

  const businessSignals = buildBusinessSignals({
    allNews,
    aiNews,
    dubaiNews,
    dubaiRegulatory,
    brentPrice: markets.brentPrice ?? markets.wtiProxyPrice,
    goldSilverRatio: ratio,
    vixValue: markets.vixValue,
    btcChange: markets.btcChange,
  });

  const markdown = buildMarkdown({
    gatheredAt,
    warSecurity,
    dubaiNews,
    dubaiRegulatory,
    aiNews,
    markets,
    metals,
    businessSignals,
    ciiScores,
    strategicRisks,
  });

  const saved = await redisSetJson(redisHourKey, markdown, { ttlSeconds: RAW_TTL_SECONDS, rawOnly: true });
  const latestRawKey = await findLatestRedisKeyWithPrefix(RAW_KEY_PREFIX);

  return jsonResponse({
    ok: true,
    saved,
    key: redisHourKey,
    latestKnownRawKey: latestRawKey,
    gatheredAt: gatheredAt.toISOString(),
    stats: {
      totalNewsItems: allNews.length,
      warSecurity: warSecurity.length,
      dubai: dubaiNews.length,
      ai: aiNews.length,
      businessSignals: businessSignals.length,
    },
  });
}
