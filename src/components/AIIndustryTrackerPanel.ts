import { Panel } from './Panel';
import { t } from '@/services/i18n';
import { fetchCategoryFeeds } from '@/services/rss';
import { fetchHackernewsItems } from '@/services/research';
import type { Feed, NewsItem } from '@/types';
import { formatTime, rssProxyUrl } from '@/utils';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';

const RETRY_DELAY_MS = 20_000;

const AI_NEWS_FEEDS: Feed[] = [
  { name: 'TechCrunch AI', url: rssProxyUrl('https://techcrunch.com/category/artificial-intelligence/feed/') },
  { name: 'The Verge AI', url: rssProxyUrl('https://www.theverge.com/rss/ai-artificial-intelligence/index.xml') },
  { name: 'ArXiv cs.AI', url: rssProxyUrl('https://export.arxiv.org/rss/cs.AI') },
];

const HN_AI_KEYWORDS = [
  'ai',
  'llm',
  'gpt',
  'claude',
  'gemini',
  'machine learning',
  'neural',
  'transformer',
  'agent',
  'agi',
];

const MODEL_RELEASE_KEYWORDS = [
  'release',
  'launch',
  'model',
  'gpt',
  'claude',
  'gemini',
  'llama',
  'mistral',
  'version',
  'update',
  'api',
  'pricing',
];

const UAE_AI_KEYWORDS = [
  'dubai',
  'uae',
  'abu dhabi',
  'difc',
  'adgm',
  'vara',
  'middle east',
  'gulf',
  'regulation',
];

function includesKeyword(title: string, keywords: string[]): boolean {
  const normalized = title.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

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

export class AIIndustryTrackerPanel extends Panel {
  private loading = true;

  constructor() {
    super({ id: 'ai-industry-tracker', title: t('panels.aiIndustryTracker') });
    void this.fetchData();
  }

  public async fetchData(): Promise<void> {
    let merged: NewsItem[] = [];

    for (let attempt = 0; attempt < 3; attempt++) {
      const [hnResult, rssResult] = await Promise.allSettled([
        fetchHackernewsItems('top', 120),
        fetchCategoryFeeds(AI_NEWS_FEEDS, { batchSize: 3 }),
      ]);

      if (!this.element?.isConnected) return;

      const hnItems: NewsItem[] = hnResult.status === 'fulfilled'
        ? hnResult.value
          .filter((item) => includesKeyword(item.title || '', HN_AI_KEYWORDS))
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
          .map((item) => ({
            source: `Hacker News (${item.score})`,
            title: item.title,
            link: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
            pubDate: new Date(item.submittedAt),
            isAlert: false,
          }))
        : [];

      const rssItems = rssResult.status === 'fulfilled' ? rssResult.value : [];
      merged = dedupeItems([...hnItems, ...rssItems]).sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

      if (merged.length > 0) break;

      if (attempt < 2) {
        this.showRetrying();
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    this.loading = false;
    this.renderPanel(merged);
  }

  private renderHeadline(item: NewsItem): string {
    const safeLink = sanitizeUrl(item.link);
    if (!safeLink) return '';

    return `
      <a class="ait-item" href="${safeLink}" target="_blank" rel="noopener noreferrer">
        <span class="ait-item-title">${escapeHtml(item.title)}</span>
        <span class="ait-item-meta">${escapeHtml(item.source)} · ${escapeHtml(formatTime(item.pubDate))}</span>
      </a>
    `;
  }

  private renderSection(title: string, items: NewsItem[], emptyText: string, limit: number): string {
    const listHtml = items
      .slice(0, limit)
      .map((item) => this.renderHeadline(item))
      .filter(Boolean)
      .join('');

    return `
      <div class="ait-section">
        <div class="ait-section-title">${escapeHtml(title)}</div>
        <div class="ait-list">
          ${listHtml || `<div class="ait-empty">${escapeHtml(emptyText)}</div>`}
        </div>
      </div>
    `;
  }

  private renderPanel(items: NewsItem[]): void {
    if (this.loading) {
      this.showLoading();
      return;
    }

    if (items.length === 0) {
      this.showError(t('common.noNewsAvailable'));
      return;
    }

    const modelReleases = items.filter((item) => includesKeyword(item.title, MODEL_RELEASE_KEYWORDS));
    const uaeAi = items.filter((item) => includesKeyword(item.title, UAE_AI_KEYWORDS));

    const html = `
      <div class="ait-container">
        ${this.renderSection('Latest AI Headlines', items, 'No AI headlines right now.', 14)}
        ${this.renderSection('Model Releases', modelReleases, 'No model release headlines right now.', 8)}
        ${this.renderSection('Dubai/UAE AI', uaeAi, 'No Dubai/UAE AI headlines right now.', 8)}
      </div>
    `;

    this.setContent(html);
  }
}
