import { Panel } from './Panel';
import { t } from '@/services/i18n';
import { fetchCategoryFeeds } from '@/services/rss';
import { fetchMultipleStocks } from '@/services/market';
import type { Feed, MarketData, NewsItem } from '@/types';
import { formatPrice, formatChange, getChangeClass, formatTime, rssProxyUrl } from '@/utils';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';

const PRICE_RETRY_DELAY_MS = 20_000;
const METAL_SYMBOLS = [
  { symbol: 'SI=F', name: 'Silver', display: 'XAGUSD' },
  { symbol: 'GC=F', name: 'Gold', display: 'XAUUSD' },
];

const PRECIOUS_METALS_FEEDS: Feed[] = [
  { name: 'Kitco Gold', url: rssProxyUrl('https://www.kitco.com/rss/gold.xml') },
  { name: 'Kitco Silver', url: rssProxyUrl('https://www.kitco.com/rss/silver.xml') },
  { name: 'Silver Institute', url: rssProxyUrl('https://silverinstitute.org/feed/') },
];

type RatioSignal = 'green' | 'yellow' | 'red';

export class PreciousMetalsCommandPanel extends Panel {
  private loading = true;

  constructor() {
    super({ id: 'precious-metals-command', title: t('panels.preciousMetalsCommand') });
    void this.fetchData();
  }

  public async fetchData(): Promise<void> {
    let latestQuotes: MarketData[] = [];
    let latestHeadlines: NewsItem[] = [];
    let haveBothMetals = false;
    let sawRateLimit = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      const [quotesResult, newsResult] = await Promise.allSettled([
        fetchMultipleStocks([...METAL_SYMBOLS], { useCommodityBreaker: true }),
        fetchCategoryFeeds(PRECIOUS_METALS_FEEDS, { batchSize: 3 }),
      ]);

      if (!this.element?.isConnected) return;

      if (quotesResult.status === 'fulfilled') {
        latestQuotes = quotesResult.value.data;
        sawRateLimit = !!quotesResult.value.rateLimited;
        haveBothMetals = this.hasBothMetals(latestQuotes);
      }

      if (newsResult.status === 'fulfilled') {
        latestHeadlines = newsResult.value;
      }

      if (haveBothMetals) break;

      if (attempt < 2) {
        this.showRetrying();
        await new Promise((resolve) => setTimeout(resolve, PRICE_RETRY_DELAY_MS));
      }
    }

    this.loading = false;

    if (!haveBothMetals) {
      this.showError(sawRateLimit ? t('common.rateLimitedMarket') : t('common.failedCommodities'));
      return;
    }

    this.renderPanel(latestQuotes, latestHeadlines);
  }

  private hasBothMetals(quotes: MarketData[]): boolean {
    const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
    const silver = bySymbol.get('SI=F');
    const gold = bySymbol.get('GC=F');
    return (silver?.price ?? null) !== null && (gold?.price ?? null) !== null;
  }

  private getRatioSignal(ratio: number): RatioSignal {
    if (ratio > 85) return 'green';
    if (ratio >= 75) return 'yellow';
    return 'red';
  }

  private renderPanel(quotes: MarketData[], headlines: NewsItem[]): void {
    if (this.loading) {
      this.showLoading();
      return;
    }

    const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
    const silver = bySymbol.get('SI=F');
    const gold = bySymbol.get('GC=F');
    const silverPrice = silver?.price;
    const goldPrice = gold?.price;
    if (!silver || !gold || silverPrice == null || goldPrice == null) {
      this.showError(t('common.failedCommodities'));
      return;
    }

    const ratio = goldPrice / silverPrice;
    const ratioSignal = this.getRatioSignal(ratio);
    const ratioNote = ratioSignal === 'green'
      ? 'Silver is cheap relative to gold (bullish)'
      : ratioSignal === 'yellow'
        ? 'Neutral zone'
        : 'Silver is expensive relative to gold';

    const renderMetalRow = (quote: MarketData, subtitle: string): string => {
      const hasChange = quote.change !== null;
      const change = quote.change ?? 0;
      const changeClass = hasChange ? getChangeClass(change) : '';
      const price = quote.price ?? 0;
      return `
        <div class="pmc-metal-row">
          <div class="pmc-metal-info">
            <div class="pmc-metal-symbol">${escapeHtml(quote.display)}</div>
            <div class="pmc-metal-name">${escapeHtml(subtitle)}</div>
          </div>
          <div class="pmc-metal-data">
            <div class="pmc-metal-price">${formatPrice(price)}</div>
            <div class="pmc-metal-change ${changeClass}">${hasChange ? formatChange(change) : 'N/A'}</div>
          </div>
        </div>
      `;
    };

    const newsItems = headlines
      .slice(0, 5)
      .map((item) => {
        const safeLink = sanitizeUrl(item.link);
        if (!safeLink) return '';
        return `
          <a class="pmc-news-item" href="${safeLink}" target="_blank" rel="noopener noreferrer">
            <span class="pmc-news-title">${escapeHtml(item.title)}</span>
            <span class="pmc-news-meta">${escapeHtml(item.source)} · ${escapeHtml(formatTime(item.pubDate))}</span>
          </a>
        `;
      })
      .filter(Boolean)
      .join('');

    const html = `
      <div class="pmc-container">
        <div class="pmc-metals">
          ${renderMetalRow(silver, 'Silver')}
          ${renderMetalRow(gold, 'Gold')}
        </div>

        <div class="pmc-ratio-card pmc-ratio-${ratioSignal}">
          <div class="pmc-ratio-label">Gold-Silver Ratio</div>
          <div class="pmc-ratio-value">${ratio.toFixed(2)}</div>
          <div class="pmc-ratio-note">${escapeHtml(ratioNote)}</div>
        </div>

        <div class="pmc-news-block">
          <div class="pmc-news-heading">Precious Metals Headlines</div>
          <div class="pmc-news-list">
            ${newsItems || '<div class="pmc-news-empty">No precious metals headlines right now.</div>'}
          </div>
        </div>
      </div>
    `;

    this.setContent(html);
  }
}
