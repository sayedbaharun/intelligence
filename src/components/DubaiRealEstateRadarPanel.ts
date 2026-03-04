import { Panel } from './Panel';
import { t } from '@/services/i18n';
import { fetchCategoryFeeds } from '@/services/rss';
import type { Feed, NewsItem } from '@/types';
import { formatTime, rssProxyUrl } from '@/utils';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';

const RETRY_DELAY_MS = 20_000;

const DUBAI_REAL_ESTATE_FEEDS: Feed[] = [
  {
    name: 'Gulf News Property',
    url: rssProxyUrl('https://news.google.com/rss/search?q=site:gulfnews.com+(Dubai+property+OR+Dubai+real+estate+OR+RERA+OR+DLD)+when:7d&hl=en-US&gl=US&ceid=US:en'),
  },
  {
    name: 'Khaleej Times Real Estate',
    url: rssProxyUrl('https://news.google.com/rss/search?q=site:khaleejtimes.com+(Dubai+real+estate+OR+property+market+OR+mortgage)+when:7d&hl=en-US&gl=US&ceid=US:en'),
  },
  {
    name: 'Arabian Business Property',
    url: rssProxyUrl('https://news.google.com/rss/search?q=site:arabianbusiness.com+(Dubai+real+estate+OR+off-plan+OR+property+market)+when:7d&hl=en-US&gl=US&ceid=US:en'),
  },
  {
    name: 'Construction Week Online',
    url: rssProxyUrl('https://news.google.com/rss/search?q=site:constructionweekonline.com+(Dubai+real+estate+OR+construction+property+OR+handover)+when:7d&hl=en-US&gl=US&ceid=US:en'),
  },
];

const REGULATORY_KEYWORDS = [
  'rera',
  'dld',
  'regulation',
  'law',
  'decree',
  'visa',
  'golden visa',
  'mortgage',
  'escrow',
  'off-plan',
];

const DISTRESSED_KEYWORDS = [
  'distressed',
  'discount',
  'price drop',
  'price cut',
  'payment plan',
  'handover delay',
  'cancelled',
  'liquidation',
  'foreclosure',
];

function dedupeItems(items: NewsItem[]): NewsItem[] {
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

function matchesKeywords(title: string, keywords: string[]): boolean {
  const normalizedTitle = title.toLowerCase();
  return keywords.some((keyword) => normalizedTitle.includes(keyword));
}

export class DubaiRealEstateRadarPanel extends Panel {
  private loading = true;
  private latestRegulatoryAlerts: NewsItem[] = [];

  constructor() {
    super({ id: 'dubai-real-estate-radar', title: t('panels.dubaiRealEstateRadar') });
    void this.fetchData();
  }

  public async fetchData(): Promise<void> {
    let latestHeadlines: NewsItem[] = [];

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        latestHeadlines = await fetchCategoryFeeds(DUBAI_REAL_ESTATE_FEEDS, { batchSize: 4 });
        if (!this.element?.isConnected) return;
        if (latestHeadlines.length > 0) break;

        if (attempt < 2) {
          this.showRetrying();
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      } catch {
        if (!this.element?.isConnected) return;
        if (attempt < 2) {
          this.showRetrying();
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }
      }
    }

    this.loading = false;
    this.renderPanel(latestHeadlines);
  }

  private renderHeadlineItem(item: NewsItem): string {
    const safeLink = sanitizeUrl(item.link);
    if (!safeLink) return '';

    return `
      <a class="drr-item" href="${safeLink}" target="_blank" rel="noopener noreferrer">
        <span class="drr-item-title">${escapeHtml(item.title)}</span>
        <span class="drr-item-meta">${escapeHtml(item.source)} · ${escapeHtml(formatTime(item.pubDate))}</span>
      </a>
    `;
  }

  private renderSection(title: string, items: NewsItem[], emptyText: string, limit = 6): string {
    const html = items
      .slice(0, limit)
      .map((item) => this.renderHeadlineItem(item))
      .filter(Boolean)
      .join('');

    return `
      <div class="drr-section">
        <div class="drr-section-title">${escapeHtml(title)}</div>
        <div class="drr-list">
          ${html || `<div class="drr-empty">${escapeHtml(emptyText)}</div>`}
        </div>
      </div>
    `;
  }

  private renderPanel(headlines: NewsItem[]): void {
    if (this.loading) {
      this.showLoading();
      return;
    }

    const deduped = dedupeItems(headlines);
    if (deduped.length === 0) {
      this.latestRegulatoryAlerts = [];
      this.showError(t('common.noNewsAvailable'));
      return;
    }

    const regulatoryAlerts = deduped.filter((item) => matchesKeywords(item.title, REGULATORY_KEYWORDS));
    const distressedSignals = deduped.filter((item) => matchesKeywords(item.title, DISTRESSED_KEYWORDS));
    this.latestRegulatoryAlerts = regulatoryAlerts;

    const html = `
      <div class="drr-container">
        ${this.renderSection('Latest Dubai Property Headlines', deduped, 'No Dubai property headlines found.', 8)}
        ${this.renderSection('Regulatory Alerts', regulatoryAlerts, 'No regulatory alerts right now.', 5)}
        ${this.renderSection('Distressed Signals', distressedSignals, 'No distressed signals right now.', 5)}
      </div>
    `;

    this.setContent(html);
  }

  public getRegulatoryAlerts(): NewsItem[] {
    return [...this.latestRegulatoryAlerts];
  }
}
