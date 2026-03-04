import { Panel } from './Panel';
import { t } from '@/services/i18n';
import type { CryptoData, NewsItem } from '@/types';
import type { FredSeries, OilAnalytics } from '@/services/economic';
import { formatTime } from '@/utils';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';

const MAX_ALERTS = 20;
const BRENT_ALERT_THRESHOLD = 90;
const GOLD_SILVER_ALERT_THRESHOLD = 85;
const VIX_ALERT_THRESHOLD = 25;
const BTC_PUMP_THRESHOLD = 5;

const GULF_CONFLICT_KEYWORDS = ['dubai', 'uae', 'gulf', 'hormuz', 'abu dhabi', 'jebel ali'];
const AI_RELEASE_KEYWORDS = ['release', 'launch', 'new model'];
const AI_VENDOR_KEYWORDS = ['openai', 'anthropic', 'google', 'meta', 'mistral'];
const DUBAI_REGULATORY_KEYWORDS = ['rera', 'dld', 'regulation', 'law', 'decree', 'visa', 'golden visa', 'mortgage', 'escrow', 'off-plan'];
const AIRSPACE_DISRUPTION_KEYWORDS = ['airspace closed', 'airspace restricted', 'flight suspended', 'airport closed'];
const AIRSPACE_REGION_KEYWORDS = ['uae', 'dubai', 'gulf', 'abu dhabi', 'hormuz', 'jebel ali'];

type AlertTone = 'critical' | 'market' | 'opportunity' | 'regulatory';

interface AlertEvidence {
  title: string;
  source: string;
  link: string;
  pubDate: Date;
}

interface BusinessAlert {
  id: string;
  ruleKey: string;
  icon: string;
  title: string;
  businesses: string[];
  actions: string[];
  timestamp: Date;
  tone: AlertTone;
  context?: string;
  evidence?: AlertEvidence;
}

interface RuleTrigger {
  ruleKey: string;
  fingerprint: string;
  alert: Omit<BusinessAlert, 'id'>;
}

export interface BusinessRadarSources {
  getAllNews: () => NewsItem[];
  getPreciousMetalsRatio: () => number | null;
  getAiIndustryHeadlines: () => NewsItem[];
  getDubaiRegulatoryHeadlines: () => NewsItem[];
  getOilData: () => OilAnalytics | null;
  getFredData: () => FredSeries[];
  getCryptoData: () => CryptoData[];
}

function matchesAnyKeyword(title: string, keywords: string[]): boolean {
  const normalized = title.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function isHighSeverityOrBreaking(item: NewsItem): boolean {
  const level = item.threat?.level;
  if (item.isAlert) return true;
  if (level === 'high' || level === 'critical') return true;
  return item.title.toLowerCase().includes('breaking');
}

function parseDate(dateLike: string | Date | null | undefined): Date | null {
  if (!dateLike) return null;
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];

  for (const item of items) {
    const key = `${item.title.trim().toLowerCase()}|${item.link.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function pickNewest(items: NewsItem[]): NewsItem | null {
  let newest: NewsItem | null = null;
  let newestTime = -Infinity;

  for (const item of items) {
    const time = item.pubDate.getTime();
    if (!Number.isFinite(time)) continue;
    if (time > newestTime) {
      newest = item;
      newestTime = time;
    }
  }

  return newest;
}

function newsFingerprint(item: NewsItem): string {
  return `${item.source}|${item.title.trim().toLowerCase()}|${item.link.trim()}`;
}

export class BusinessRadarPanel extends Panel {
  private readonly sources: BusinessRadarSources;
  private readonly activeRuleFingerprints = new Map<string, string>();
  private alerts: BusinessAlert[] = [];
  private loading = true;
  private nextAlertId = 1;

  constructor(sources: BusinessRadarSources) {
    super({ id: 'business-radar', title: t('panels.businessRadar') });
    this.sources = sources;
    void this.fetchData();
  }

  public async fetchData(): Promise<void> {
    if (!this.element?.isConnected) return;

    const now = new Date();
    const triggeredRules = this.evaluateRules(now);
    this.syncAlerts(triggeredRules);

    this.loading = false;
    this.renderPanel(triggeredRules.length);
  }

  private evaluateRules(now: Date): RuleTrigger[] {
    const allNews = this.sources.getAllNews();
    const aiHeadlines = this.sources.getAiIndustryHeadlines();
    const dubaiRegulatoryHeadlines = this.sources.getDubaiRegulatoryHeadlines();
    const ratio = this.sources.getPreciousMetalsRatio();
    const oilData = this.sources.getOilData();
    const fredData = this.sources.getFredData();
    const cryptoData = this.sources.getCryptoData();

    const triggers: RuleTrigger[] = [];

    const brentPrice = oilData?.brentPrice?.current ?? null;
    if (brentPrice !== null && brentPrice > BRENT_ALERT_THRESHOLD) {
      const timestamp = parseDate(oilData?.brentPrice?.lastUpdated) ?? now;
      triggers.push({
        ruleKey: 'oil-spike',
        fingerprint: 'above-threshold',
        alert: {
          ruleKey: 'oil-spike',
          icon: '🛢️',
          title: 'Oil above $90 — Energy costs rising',
          businesses: [
            'Aivant Realty: Construction costs may increase. Watch developer margins.',
            'ArabMoney: Content opportunity — oil price impact explainer',
          ],
          actions: [
            'Review project cost assumptions and procurement plans.',
            'Publish an oil impact explainer while momentum is high.',
          ],
          timestamp,
          tone: 'market',
          context: `Brent: $${brentPrice.toFixed(2)}`,
        },
      });
    }

    if (ratio !== null && ratio > GOLD_SILVER_ALERT_THRESHOLD) {
      triggers.push({
        ruleKey: 'silver-signal',
        fingerprint: 'above-threshold',
        alert: {
          ruleKey: 'silver-signal',
          icon: '⚪',
          title: 'Gold-Silver ratio above 85 — Silver historically undervalued',
          businesses: [
            'Trading: Consider adding to XAGUSD long position',
          ],
          actions: [
            'Recheck entry levels and risk sizing for XAGUSD long exposure.',
          ],
          timestamp: now,
          tone: 'market',
          context: `Ratio: ${ratio.toFixed(2)}`,
        },
      });
    }

    const gulfConflictSignal = pickNewest(
      allNews.filter((item) => isHighSeverityOrBreaking(item) && matchesAnyKeyword(item.title, GULF_CONFLICT_KEYWORDS))
    );
    if (gulfConflictSignal) {
      triggers.push({
        ruleKey: 'gulf-conflict',
        fingerprint: newsFingerprint(gulfConflictSignal),
        alert: {
          ruleKey: 'gulf-conflict',
          icon: '🔴',
          title: 'Gulf conflict signal detected',
          businesses: [
            'MyDub.ai: Breaking news content opportunity — publish immediately',
            'Aivant Realty: Monitor buyer sentiment impact',
            'All ventures: Check physical infrastructure and travel status',
          ],
          actions: [
            'Trigger breaking content workflow immediately.',
            'Brief teams on travel/infrastructure risk and continuity plans.',
          ],
          timestamp: gulfConflictSignal.pubDate,
          tone: 'critical',
          evidence: gulfConflictSignal,
        },
      });
    }

    const aiModelReleaseSignal = pickNewest(
      aiHeadlines.filter((item) => matchesAnyKeyword(item.title, AI_RELEASE_KEYWORDS) && matchesAnyKeyword(item.title, AI_VENDOR_KEYWORDS))
    );
    if (aiModelReleaseSignal) {
      triggers.push({
        ruleKey: 'ai-model-release',
        fingerprint: newsFingerprint(aiModelReleaseSignal),
        alert: {
          ruleKey: 'ai-model-release',
          icon: '🤖',
          title: 'Major AI model release detected',
          businesses: [
            'Hikma Digital: Evaluate for client automation offerings',
            'OpenClaw: Check if new model should be integrated',
          ],
          actions: [
            'Run rapid model capability and pricing assessment.',
            'Decide integration roadmap and client messaging.',
          ],
          timestamp: aiModelReleaseSignal.pubDate,
          tone: 'opportunity',
          evidence: aiModelReleaseSignal,
        },
      });
    }

    const vixValue = fredData.find((series) => series.id === 'VIXCLS')?.value ?? null;
    if (vixValue !== null && vixValue > VIX_ALERT_THRESHOLD) {
      triggers.push({
        ruleKey: 'market-fear',
        fingerprint: 'above-threshold',
        alert: {
          ruleKey: 'market-fear',
          icon: '📉',
          title: 'High market volatility (VIX > 25)',
          businesses: [
            'ArabMoney: Volatility content — fear/greed explainer',
            'Trading: Heightened risk, tighten stops',
          ],
          actions: [
            'Raise risk controls on open positions.',
            'Publish volatility/fear-greed context content.',
          ],
          timestamp: now,
          tone: 'market',
          context: `VIX: ${vixValue.toFixed(2)}`,
        },
      });
    }

    const btc = cryptoData.find((coin) => coin.symbol.toUpperCase() === 'BTC');
    if (btc && btc.change > BTC_PUMP_THRESHOLD) {
      triggers.push({
        ruleKey: 'crypto-pump',
        fingerprint: 'above-threshold',
        alert: {
          ruleKey: 'crypto-pump',
          icon: '₿',
          title: 'Bitcoin moving significantly (+5%+ in 24h)',
          businesses: [
            'ArabMoney: Crypto content opportunity',
          ],
          actions: [
            'Ship a fast crypto momentum update for audience capture.',
          ],
          timestamp: now,
          tone: 'opportunity',
          context: `BTC 24h: ${btc.change > 0 ? '+' : ''}${btc.change.toFixed(2)}%`,
        },
      });
    }

    const dubaiRegulatorySignal = pickNewest(
      dubaiRegulatoryHeadlines.filter((item) => matchesAnyKeyword(item.title, DUBAI_REGULATORY_KEYWORDS))
    );
    if (dubaiRegulatorySignal) {
      triggers.push({
        ruleKey: 'dubai-regulatory',
        fingerprint: newsFingerprint(dubaiRegulatorySignal),
        alert: {
          ruleKey: 'dubai-regulatory',
          icon: '📋',
          title: 'Dubai regulatory update detected',
          businesses: [
            'Aivant Realty: Review for client impact',
            'Hikma Digital: Check if regulation affects AI/tech clients',
          ],
          actions: [
            'Review exposure across real-estate and client advisory workflows.',
          ],
          timestamp: dubaiRegulatorySignal.pubDate,
          tone: 'regulatory',
          evidence: dubaiRegulatorySignal,
        },
      });
    }

    const airspacePool = dedupeNews([...allNews, ...aiHeadlines, ...dubaiRegulatoryHeadlines]);
    const airspaceSignal = pickNewest(
      airspacePool.filter((item) =>
        matchesAnyKeyword(item.title, AIRSPACE_DISRUPTION_KEYWORDS)
        && matchesAnyKeyword(item.title, AIRSPACE_REGION_KEYWORDS))
    );
    if (airspaceSignal) {
      triggers.push({
        ruleKey: 'airspace-restriction',
        fingerprint: newsFingerprint(airspaceSignal),
        alert: {
          ruleKey: 'airspace-restriction',
          icon: '✈️',
          title: 'Gulf airspace/airport disruption',
          businesses: [
            'All ventures: Check travel plans',
            'MyDub.ai: Breaking travel advisory content',
          ],
          actions: [
            'Issue immediate internal travel advisory.',
            'Publish travel disruption update with alternatives.',
          ],
          timestamp: airspaceSignal.pubDate,
          tone: 'critical',
          evidence: airspaceSignal,
        },
      });
    }

    return triggers;
  }

  private syncAlerts(triggers: RuleTrigger[]): void {
    const nextFingerprints = new Map<string, string>();

    for (const trigger of triggers) {
      nextFingerprints.set(trigger.ruleKey, trigger.fingerprint);
      const previousFingerprint = this.activeRuleFingerprints.get(trigger.ruleKey);
      if (previousFingerprint === trigger.fingerprint) continue;

      const alert: BusinessAlert = {
        ...trigger.alert,
        id: `br-${this.nextAlertId++}`,
      };
      this.alerts.unshift(alert);
    }

    this.activeRuleFingerprints.clear();
    for (const [ruleKey, fingerprint] of nextFingerprints) {
      this.activeRuleFingerprints.set(ruleKey, fingerprint);
    }

    this.alerts = this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, MAX_ALERTS);
  }

  private renderPanel(activeRuleCount: number): void {
    if (this.loading) {
      this.showLoading();
      return;
    }

    const status = activeRuleCount === 0
      ? `<div class="br-status br-status-clear">All Clear — no rules are currently triggered.</div>`
      : `<div class="br-status br-status-alert">${activeRuleCount} active signal${activeRuleCount === 1 ? '' : 's'} detected.</div>`;

    const alertsHtml = this.alerts.length > 0
      ? this.alerts.map((alert) => this.renderAlert(alert)).join('')
      : '<div class="br-empty">No alerts yet. Business Radar is monitoring all connected panels.</div>';

    this.setContent(`
      <div class="br-container">
        ${status}
        <div class="br-list">${alertsHtml}</div>
      </div>
    `);
  }

  private renderAlert(alert: BusinessAlert): string {
    const evidence = alert.evidence ? this.renderEvidence(alert.evidence) : '';
    const context = alert.context ? `<div class="br-context">${escapeHtml(alert.context)}</div>` : '';

    return `
      <article class="br-alert br-tone-${alert.tone}">
        <div class="br-alert-head">
          <span class="br-icon">${escapeHtml(alert.icon)}</span>
          <div class="br-title-wrap">
            <div class="br-title">${escapeHtml(alert.title)}</div>
            <div class="br-time">${escapeHtml(formatTime(alert.timestamp))}</div>
          </div>
        </div>
        ${context}
        <div class="br-section-label">Business Impact</div>
        <div class="br-lines">
          ${alert.businesses.map((line) => `<div class="br-line">${escapeHtml(line)}</div>`).join('')}
        </div>
        <div class="br-section-label">What To Do</div>
        <div class="br-lines">
          ${alert.actions.map((line) => `<div class="br-line">${escapeHtml(line)}</div>`).join('')}
        </div>
        ${evidence}
      </article>
    `;
  }

  private renderEvidence(evidence: AlertEvidence): string {
    const safeLink = sanitizeUrl(evidence.link);
    const meta = `${evidence.source} · ${formatTime(evidence.pubDate)}`;
    if (!safeLink) {
      return `
        <div class="br-evidence">
          <div class="br-evidence-meta">${escapeHtml(meta)}</div>
          <div class="br-evidence-title">${escapeHtml(evidence.title)}</div>
        </div>
      `;
    }

    return `
      <a class="br-evidence br-evidence-link" href="${safeLink}" target="_blank" rel="noopener noreferrer">
        <div class="br-evidence-meta">${escapeHtml(meta)}</div>
        <div class="br-evidence-title">${escapeHtml(evidence.title)}</div>
      </a>
    `;
  }
}
