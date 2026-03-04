import {
  findLatestRedisKeyWithPrefix,
  formatDubaiTimestamp,
  jsonResponse,
  redisGetJson,
  redisSetJson,
  sendTelegramText,
  toHourBucketKey,
} from './_shared.js';

export const config = { runtime: 'edge' };

const RAW_KEY_PREFIX = 'briefing:raw';
const ANALYSIS_LATEST_KEY = 'briefing:analysis:latest';
const ANALYSIS_ARCHIVE_PREFIX = 'briefing:analysis';
const ANALYSIS_ARCHIVE_TTL_SECONDS = 7 * 24 * 60 * 60;
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';

const SYSTEM_PROMPT = `You are SENTINEL, a personal intelligence analyst for a multi-venture operator based in Dubai. You produce concise, actionable daily intelligence briefings.

You will receive two inputs:
1. RAW INTELLIGENCE — today's gathered data
2. PREVIOUS BRIEFING — the last analysis (to identify what's NEW)

Your job:
- Focus ONLY on what's NEW or CHANGED since the last briefing
- For each section, lead with the most important development
- Tag everything as CONFIRMED / CLAIMED / UNVERIFIED
- Think about second-order effects (e.g., Hormuz closure → oil spike → construction costs → Dubai real estate pressure)
- End with specific ACTION ITEMS for these businesses: MyDub.ai (news/content), Hikma Digital (AI agency), Aivant Realty (Dubai property), ArabMoney (finance content), My Sigma Mindset (motivational content), and silver/gold trading positions

Format your output EXACTLY like this:

🔔 SENTINEL — [Date] | [Time] GST

⚔️ WAR & SECURITY
[2-4 bullet points, most important first]

🏠 DUBAI REAL ESTATE  
[2-3 bullet points]

⚪ SILVER & METALS
[Current prices, ratio, 1-2 key signals]

🤖 AI & TECH
[2-3 bullet points]

📈 MARKETS
[Key numbers: oil, BTC, VIX, any notable moves]

🎯 ACTION ITEMS
[Specific things to do TODAY, tagged by business]

⏰ WATCH LIST (next 24h)
[3-5 triggers to monitor]

Keep the TOTAL output under 4000 characters. Be direct, no fluff.`;

function unwrapText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value?.text === 'string') return value.text;
  return '';
}

function buildRawFallbackText(rawText, now) {
  return [
    `🔔 SENTINEL — ${formatDubaiTimestamp(now)} GST`,
    '',
    'Anthropic analysis unavailable. RAW INTELLIGENCE fallback:',
    '',
    rawText || 'No raw briefing payload found.',
  ].join('\n');
}

function buildMissingRawText(now) {
  return [
    `🔔 SENTINEL — ${formatDubaiTimestamp(now)} GST`,
    '',
    'SENTINEL analyze run completed, but no recent RAW INTELLIGENCE snapshot was found in Redis.',
    'Gather phase likely failed or has not run yet. Check /api/briefing/gather logs.',
  ].join('\n');
}

async function findRecentRawBriefing(now) {
  const candidates = [];
  for (const offsetHours of [1, 0, 2, 3, 4, 5, 6, 12]) {
    const d = new Date(now.getTime() - offsetHours * 60 * 60 * 1000);
    candidates.push(`${RAW_KEY_PREFIX}:${toHourBucketKey(d)}`);
  }

  for (const key of candidates) {
    const data = await redisGetJson(key, { rawOnly: true });
    const text = unwrapText(data);
    if (text) return { key, text };
  }

  const latestKey = await findLatestRedisKeyWithPrefix(RAW_KEY_PREFIX);
  if (!latestKey) return null;
  const latestData = await redisGetJson(latestKey, { rawOnly: true });
  const latestText = unwrapText(latestData);
  if (!latestText) return null;
  return { key: latestKey, text: latestText };
}

async function callAnthropicAnalysis(apiKey, rawText, previousBriefing) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      system: SYSTEM_PROMPT,
      max_tokens: 1400,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'RAW INTELLIGENCE:',
                rawText,
                '',
                'PREVIOUS BRIEFING:',
                previousBriefing || 'No previous briefing available.',
              ].join('\n'),
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(55_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic HTTP ${response.status}: ${body.slice(0, 400)}`);
  }

  const payload = await response.json();
  const text = Array.isArray(payload?.content)
    ? payload.content
      .filter((part) => part?.type === 'text' && typeof part?.text === 'string')
      .map((part) => part.text)
      .join('\n')
      .trim()
    : '';

  if (!text) {
    throw new Error('Anthropic returned an empty response body');
  }

  return text;
}

export default async function handler(req) {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const now = new Date();
  const hourKey = toHourBucketKey(now);
  const archiveKey = `${ANALYSIS_ARCHIVE_PREFIX}:${hourKey}`;

  const rawBriefing = await findRecentRawBriefing(now);
  const previousAnalysisText = unwrapText(await redisGetJson(ANALYSIS_LATEST_KEY, { rawOnly: true }));

  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const telegramChatId = process.env.TELEGRAM_CHAT_ID || '';
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

  if (!rawBriefing) {
    const missingRawMessage = buildMissingRawText(now);
    const telegramResult = await sendTelegramText(telegramBotToken, telegramChatId, missingRawMessage);
    if (!telegramResult.ok) {
      console.error('[briefing:analyze] missing-raw Telegram delivery failed:', telegramResult.error);
    }
    return jsonResponse({
      ok: true,
      warning: 'No raw briefing found',
      rawKey: null,
      telegram: telegramResult,
    });
  }

  let analysisText = '';
  let analysisMode = 'anthropic';
  if (anthropicApiKey) {
    try {
      analysisText = await callAnthropicAnalysis(anthropicApiKey, rawBriefing.text, previousAnalysisText);
    } catch (err) {
      analysisMode = 'raw-fallback';
      console.error('[briefing:analyze] Anthropic failed, using RAW fallback:', err instanceof Error ? err.message : String(err));
    }
  } else {
    analysisMode = 'raw-fallback';
    console.error('[briefing:analyze] ANTHROPIC_API_KEY missing, using RAW fallback');
  }

  const outboundText = analysisText || buildRawFallbackText(rawBriefing.text, now);
  const telegramResult = await sendTelegramText(telegramBotToken, telegramChatId, outboundText);
  if (!telegramResult.ok) {
    console.error('[briefing:analyze] Telegram delivery failed:', telegramResult.error);
  }

  const latestSaved = await redisSetJson(ANALYSIS_LATEST_KEY, outboundText, { rawOnly: true });
  const archiveSaved = await redisSetJson(archiveKey, outboundText, {
    rawOnly: true,
    ttlSeconds: ANALYSIS_ARCHIVE_TTL_SECONDS,
  });

  return jsonResponse({
    ok: true,
    mode: analysisMode,
    rawKey: rawBriefing.key,
    latestKey: ANALYSIS_LATEST_KEY,
    archiveKey,
    latestSaved,
    archiveSaved,
    telegram: telegramResult,
  });
}
