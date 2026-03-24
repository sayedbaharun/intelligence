// Operator variant — unified command center (trading + geopolitics + AI/tech + UAE/GCC)
import type { PanelConfig, MapLayers } from '@/types';
import type { VariantConfig } from './base';

// Re-export base config
export * from './base';

// Operator uses finance geo data (stock exchanges, financial centers, central banks)
export * from '../finance-geo';

// Re-export feeds infrastructure
export {
  SOURCE_TIERS,
  getSourceTier,
  SOURCE_TYPES,
  getSourceType,
  getSourcePropagandaRisk,
  type SourceRiskProfile,
  type SourceType,
} from '../feeds';

// Operator-specific FEEDS configuration
import type { Feed } from '@/types';
import { rssProxyUrl } from '@/utils';

const rss = rssProxyUrl;

export const FEEDS: Record<string, Feed[]> = {
  // ── Finance feeds (all 14 categories from finance variant) ──

  markets: [
    { name: 'CNBC', url: rss('https://www.cnbc.com/id/100003114/device/rss/rss.html') },
    { name: 'MarketWatch', url: rss('https://news.google.com/rss/search?q=site:marketwatch.com+markets+when:1d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Yahoo Finance', url: rss('https://finance.yahoo.com/rss/topstories') },
    { name: 'Seeking Alpha', url: rss('https://seekingalpha.com/market_currents.xml') },
    { name: 'Reuters Markets', url: rss('https://news.google.com/rss/search?q=site:reuters.com+markets+stocks+when:1d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Bloomberg Markets', url: rss('https://news.google.com/rss/search?q=site:bloomberg.com+markets+when:1d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Investing.com', url: rss('https://news.google.com/rss/search?q=site:investing.com+markets+when:1d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Nikkei Asia', url: rss('https://news.google.com/rss/search?q=site:asia.nikkei.com+markets+when:3d&hl=en-US&gl=US&ceid=US:en') },
  ],

  forex: [
    { name: 'Forex News', url: rss('https://news.google.com/rss/search?q=("forex"+OR+"currency"+OR+"FX+market")+trading+when:1d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Dollar Watch', url: rss('https://news.google.com/rss/search?q=("dollar+index"+OR+DXY+OR+"US+dollar"+OR+"euro+dollar")+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Central Bank Rates', url: rss('https://news.google.com/rss/search?q=("central+bank"+OR+"interest+rate"+OR+"rate+decision"+OR+"monetary+policy")+when:2d&hl=en-US&gl=US&ceid=US:en') },
  ],

  bonds: [
    { name: 'Bond Market', url: rss('https://news.google.com/rss/search?q=("bond+market"+OR+"treasury+yields"+OR+"bond+yields"+OR+"fixed+income")+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Treasury Watch', url: rss('https://news.google.com/rss/search?q=("US+Treasury"+OR+"Treasury+auction"+OR+"10-year+yield"+OR+"2-year+yield")+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Corporate Bonds', url: rss('https://news.google.com/rss/search?q=("corporate+bond"+OR+"high+yield"+OR+"investment+grade"+OR+"credit+spread")+when:3d&hl=en-US&gl=US&ceid=US:en') },
  ],

  commodities: [
    { name: 'Oil & Gas', url: rss('https://news.google.com/rss/search?q=(oil+price+OR+OPEC+OR+"natural+gas"+OR+"crude+oil"+OR+WTI+OR+Brent)+when:1d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Gold & Metals', url: rss('https://news.google.com/rss/search?q=(gold+price+OR+silver+price+OR+copper+OR+platinum+OR+"precious+metals")+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Agriculture', url: rss('https://news.google.com/rss/search?q=(wheat+OR+corn+OR+soybeans+OR+coffee+OR+sugar)+price+OR+commodity+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Commodity Trading', url: rss('https://news.google.com/rss/search?q=("commodity+trading"+OR+"futures+market"+OR+CME+OR+NYMEX+OR+COMEX)+when:2d&hl=en-US&gl=US&ceid=US:en') },
  ],

  crypto: [
    { name: 'CoinDesk', url: rss('https://www.coindesk.com/arc/outboundfeeds/rss/') },
    { name: 'Cointelegraph', url: rss('https://cointelegraph.com/rss') },
    { name: 'The Block', url: rss('https://news.google.com/rss/search?q=site:theblock.co+when:1d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Crypto News', url: rss('https://news.google.com/rss/search?q=(bitcoin+OR+ethereum+OR+crypto+OR+"digital+assets")+when:1d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'DeFi News', url: rss('https://news.google.com/rss/search?q=(DeFi+OR+"decentralized+finance"+OR+DEX+OR+"yield+farming")+when:3d&hl=en-US&gl=US&ceid=US:en') },
  ],

  centralbanks: [
    { name: 'Federal Reserve', url: rss('https://www.federalreserve.gov/feeds/press_all.xml') },
    { name: 'ECB Watch', url: rss('https://news.google.com/rss/search?q=("European+Central+Bank"+OR+ECB+OR+Lagarde)+monetary+policy+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'BoJ Watch', url: rss('https://news.google.com/rss/search?q=("Bank+of+Japan"+OR+BoJ)+monetary+policy+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'BoE Watch', url: rss('https://news.google.com/rss/search?q=("Bank+of+England"+OR+BoE)+monetary+policy+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'PBoC Watch', url: rss('https://news.google.com/rss/search?q=("People%27s+Bank+of+China"+OR+PBoC+OR+PBOC)+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Global Central Banks', url: rss('https://news.google.com/rss/search?q=("rate+hike"+OR+"rate+cut"+OR+"interest+rate+decision")+central+bank+when:3d&hl=en-US&gl=US&ceid=US:en') },
  ],

  economic: [
    { name: 'Economic Data', url: rss('https://news.google.com/rss/search?q=(CPI+OR+inflation+OR+GDP+OR+"jobs+report"+OR+"nonfarm+payrolls"+OR+PMI)+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Trade & Tariffs', url: rss('https://news.google.com/rss/search?q=(tariff+OR+"trade+war"+OR+"trade+deficit"+OR+sanctions)+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Housing Market', url: rss('https://news.google.com/rss/search?q=("housing+market"+OR+"home+prices"+OR+"mortgage+rates"+OR+REIT)+when:3d&hl=en-US&gl=US&ceid=US:en') },
  ],

  ipo: [
    { name: 'IPO News', url: rss('https://news.google.com/rss/search?q=(IPO+OR+"initial+public+offering"+OR+SPAC+OR+"direct+listing")+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Earnings Reports', url: rss('https://news.google.com/rss/search?q=("earnings+report"+OR+"quarterly+earnings"+OR+"revenue+beat"+OR+"earnings+miss")+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'M&A News', url: rss('https://news.google.com/rss/search?q=("merger"+OR+"acquisition"+OR+"takeover+bid"+OR+"buyout")+billion+when:3d&hl=en-US&gl=US&ceid=US:en') },
  ],

  derivatives: [
    { name: 'Options Market', url: rss('https://news.google.com/rss/search?q=("options+market"+OR+"options+trading"+OR+"put+call+ratio"+OR+VIX)+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Futures Trading', url: rss('https://news.google.com/rss/search?q=("futures+trading"+OR+"S%26P+500+futures"+OR+"Nasdaq+futures")+when:1d&hl=en-US&gl=US&ceid=US:en') },
  ],

  fintech: [
    { name: 'Fintech News', url: rss('https://news.google.com/rss/search?q=(fintech+OR+"payment+technology"+OR+"neobank"+OR+"digital+banking")+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Trading Tech', url: rss('https://news.google.com/rss/search?q=("algorithmic+trading"+OR+"trading+platform"+OR+"quantitative+finance")+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Blockchain Finance', url: rss('https://news.google.com/rss/search?q=("blockchain+finance"+OR+"tokenization"+OR+"digital+securities"+OR+CBDC)+when:7d&hl=en-US&gl=US&ceid=US:en') },
  ],

  regulation: [
    { name: 'SEC', url: rss('https://www.sec.gov/news/pressreleases.rss') },
    { name: 'Financial Regulation', url: rss('https://news.google.com/rss/search?q=(SEC+OR+CFTC+OR+FINRA+OR+FCA)+regulation+OR+enforcement+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Banking Rules', url: rss('https://news.google.com/rss/search?q=(Basel+OR+"capital+requirements"+OR+"banking+regulation")+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Crypto Regulation', url: rss('https://news.google.com/rss/search?q=(crypto+regulation+OR+"digital+asset"+regulation+OR+"stablecoin"+regulation)+when:7d&hl=en-US&gl=US&ceid=US:en') },
  ],

  institutional: [
    { name: 'Hedge Fund News', url: rss('https://news.google.com/rss/search?q=("hedge+fund"+OR+"Bridgewater"+OR+"Citadel"+OR+"Renaissance")+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Private Equity', url: rss('https://news.google.com/rss/search?q=("private+equity"+OR+Blackstone+OR+KKR+OR+Apollo+OR+Carlyle)+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Sovereign Wealth', url: rss('https://news.google.com/rss/search?q=("sovereign+wealth+fund"+OR+"pension+fund"+OR+"institutional+investor")+when:7d&hl=en-US&gl=US&ceid=US:en') },
  ],

  gccNews: [
    { name: 'Arabian Business', url: rss('https://news.google.com/rss/search?q=site:arabianbusiness.com+(Saudi+Arabia+OR+UAE+OR+GCC)+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'The National', url: rss('https://news.google.com/rss/search?q=site:thenationalnews.com+(Abu+Dhabi+OR+UAE+OR+Saudi)+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Arab News', url: rss('https://news.google.com/rss/search?q=site:arabnews.com+(Saudi+Arabia+OR+investment+OR+infrastructure)+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Gulf FDI', url: rss('https://news.google.com/rss/search?q=(PIF+OR+"DP+World"+OR+Mubadala+OR+ADNOC+OR+Masdar+OR+"ACWA+Power")+infrastructure+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Gulf Investments', url: rss('https://news.google.com/rss/search?q=("Saudi+Arabia"+OR+"UAE"+OR+"Abu+Dhabi")+investment+infrastructure+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Vision 2030', url: rss('https://news.google.com/rss/search?q="Vision+2030"+(project+OR+investment+OR+announced)+when:14d&hl=en-US&gl=US&ceid=US:en') },
  ],

  analysis: [
    { name: 'Market Outlook', url: rss('https://news.google.com/rss/search?q=("market+outlook"+OR+"stock+market+forecast"+OR+"bull+market"+OR+"bear+market")+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Risk & Volatility', url: rss('https://news.google.com/rss/search?q=(VIX+OR+"market+volatility"+OR+"risk+off"+OR+"market+correction")+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Bank Research', url: rss('https://news.google.com/rss/search?q=("Goldman+Sachs"+OR+"JPMorgan"+OR+"Morgan+Stanley")+forecast+OR+outlook+when:3d&hl=en-US&gl=US&ceid=US:en') },
  ],

  // ── Geopolitical feeds (from full variant) ──

  geopolitics: [
    { name: 'Reuters World', url: rss('https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en') },
    { name: 'BBC World', url: rss('https://feeds.bbci.co.uk/news/world/rss.xml') },
    { name: 'Al Jazeera', url: rss('https://www.aljazeera.com/xml/rss/all.xml') },
    { name: 'AP News', url: rss('https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en') },
    { name: 'AFP', url: rss('https://news.google.com/rss/search?q=site:afp.com+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Guardian World', url: rss('https://www.theguardian.com/world/rss') },
  ],

  middleeast: [
    { name: 'Al Jazeera', url: rss('https://www.aljazeera.com/xml/rss/all.xml') },
    { name: 'Middle East Eye', url: rss('https://www.middleeasteye.net/rss') },
    { name: 'Al-Monitor', url: rss('https://www.al-monitor.com/rss.xml') },
    { name: 'Times of Israel', url: rss('https://www.timesofisrael.com/feed/') },
    { name: 'Arab News', url: rss('https://news.google.com/rss/search?q=site:arabnews.com+when:7d&hl=en-US&gl=US&ceid=US:en') },
  ],

  energy: [
    { name: 'Oil & Gas', url: rss('https://news.google.com/rss/search?q=(oil+price+OR+OPEC+OR+"natural+gas"+OR+pipeline+OR+LNG)+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Nuclear Energy', url: rss('https://news.google.com/rss/search?q=("nuclear+energy"+OR+"nuclear+power"+OR+uranium+OR+IAEA)+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Reuters Energy', url: rss('https://news.google.com/rss/search?q=site:reuters.com+(oil+OR+gas+OR+energy+OR+OPEC)+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Mining & Resources', url: rss('https://news.google.com/rss/search?q=(lithium+OR+"rare+earth"+OR+cobalt+OR+mining)+when:3d&hl=en-US&gl=US&ceid=US:en') },
  ],

  thinktanks: [
    { name: 'Brookings', url: rss('https://news.google.com/rss/search?q=site:brookings.edu+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'CSIS', url: rss('https://news.google.com/rss/search?q=site:csis.org+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'RAND', url: rss('https://news.google.com/rss/search?q=site:rand.org+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Chatham House', url: rss('https://news.google.com/rss/search?q=site:chathamhouse.org+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Carnegie', url: rss('https://news.google.com/rss/search?q=site:carnegieendowment.org+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Foreign Affairs', url: rss('https://www.foreignaffairs.com/rss.xml') },
  ],

  // ── Tech/AI feeds (from tech variant) ──

  ai: [
    { name: 'AI News', url: rss('https://news.google.com/rss/search?q=(OpenAI+OR+Anthropic+OR+Google+AI+OR+"large+language+model"+OR+ChatGPT+OR+Claude+OR+"AI+model")+when:2d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'VentureBeat AI', url: rss('https://venturebeat.com/category/ai/feed/') },
    { name: 'The Verge AI', url: rss('https://www.theverge.com/rss/ai-artificial-intelligence/index.xml') },
    { name: 'MIT Tech Review AI', url: rss('https://www.technologyreview.com/topic/artificial-intelligence/feed') },
    { name: 'ArXiv AI', url: rss('https://export.arxiv.org/rss/cs.AI') },
  ],

  tech: [
    { name: 'TechCrunch', url: rss('https://techcrunch.com/feed/') },
    { name: 'Hacker News', url: rss('https://hnrss.org/frontpage') },
    { name: 'MIT Tech Review', url: rss('https://www.technologyreview.com/feed/') },
    { name: 'TechMeme', url: rss('https://www.techmeme.com/feed.xml') },
    { name: 'Ars Technica', url: rss('https://feeds.arstechnica.com/arstechnica/technology-lab') },
  ],

  startups: [
    { name: 'TechCrunch Startups', url: rss('https://techcrunch.com/category/startups/feed/') },
    { name: 'Crunchbase News', url: rss('https://news.crunchbase.com/feed/') },
    { name: 'VentureBeat', url: rss('https://venturebeat.com/feed/') },
    { name: 'CB Insights', url: rss('https://www.cbinsights.com/research/feed/') },
  ],

  // ── Custom feeds (operator-specific) ──

  investmentIntel: [
    { name: 'Crunchbase News', url: rss('https://news.crunchbase.com/feed/') },
    { name: 'PitchBook News', url: rss('https://news.google.com/rss/search?q=site:pitchbook.com+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'SWF Activity', url: rss('https://news.google.com/rss/search?q=("sovereign+wealth+fund"+OR+PIF+OR+Mubadala+OR+ADIA+OR+ADQ+OR+"GIC+Singapore"+OR+Temasek)+investment+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'PE & VC Deals', url: rss('https://news.google.com/rss/search?q=("funding+round"+OR+"Series+A"+OR+"Series+B"+OR+"venture+capital"+OR+"private+equity")+million+when:3d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'a16z Blog', url: rss('https://a16z.com/feed/') },
    { name: 'Y Combinator', url: rss('https://news.ycombinator.com/rss') },
  ],

  uaeBusiness: [
    { name: 'Gulf News Business', url: rss('https://news.google.com/rss/search?q=site:gulfnews.com+business+(UAE+OR+Dubai+OR+Abu+Dhabi)+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Zawya', url: rss('https://news.google.com/rss/search?q=site:zawya.com+(UAE+OR+GCC+OR+Middle+East)+when:7d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'UAE Central Bank', url: rss('https://news.google.com/rss/search?q=("UAE+Central+Bank"+OR+CBUAE)+when:14d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'DIFC News', url: rss('https://news.google.com/rss/search?q=DIFC+("Dubai+International+Financial+Centre")+when:14d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'ADGM Updates', url: rss('https://news.google.com/rss/search?q=ADGM+("Abu+Dhabi+Global+Market")+when:14d&hl=en-US&gl=US&ceid=US:en') },
  ],

  aiResearch: [
    { name: 'Hugging Face Blog', url: rss('https://huggingface.co/blog/feed.xml') },
    { name: 'OpenAI Blog', url: rss('https://news.google.com/rss/search?q=site:openai.com+blog+when:14d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Anthropic Blog', url: rss('https://news.google.com/rss/search?q=site:anthropic.com+when:14d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Google DeepMind', url: rss('https://news.google.com/rss/search?q=site:deepmind.google+when:14d&hl=en-US&gl=US&ceid=US:en') },
    { name: 'AI Product Launches', url: rss('https://news.google.com/rss/search?q=("AI+launch"+OR+"AI+product"+OR+"AI+startup"+OR+"AI+tool")+launch+when:3d&hl=en-US&gl=US&ceid=US:en') },
  ],
};

// Panel configuration — ordered by daily priority flow
export const DEFAULT_PANELS: Record<string, PanelConfig> = {
  // Priority 1 — top of grid, daily essentials
  map: { name: 'Operator Command Map', enabled: true, priority: 1 },
  'live-news': { name: 'Live Headlines', enabled: true, priority: 1 },
  'live-webcams': { name: 'Live Webcams', enabled: true, priority: 1 },
  insights: { name: 'AI Intelligence Brief', enabled: true, priority: 1 },
  'strategic-posture': { name: 'AI Strategic Posture', enabled: true, priority: 1 },
  'macro-signals': { name: 'Market Radar', enabled: true, priority: 1 },
  markets: { name: 'Live Markets', enabled: true, priority: 1 },
  forex: { name: 'Forex & Currencies', enabled: true, priority: 1 },
  commodities: { name: 'Commodities & Futures', enabled: true, priority: 1 },
  'precious-metals-command': { name: 'Precious Metals Command', enabled: true, priority: 1 },
  crypto: { name: 'Crypto & Digital Assets', enabled: true, priority: 1 },
  cii: { name: 'Country Instability Index', enabled: true, priority: 1 },
  'strategic-risk': { name: 'Strategic Risk Overview', enabled: true, priority: 1 },
  polymarket: { name: 'Prediction Markets', enabled: true, priority: 1 },
  geopolitics: { name: 'Geopolitics', enabled: true, priority: 1 },
  middleeast: { name: 'Middle East', enabled: true, priority: 1 },
  energy: { name: 'Energy & Resources', enabled: true, priority: 1 },
  'trade-policy': { name: 'Trade Policy', enabled: true, priority: 1 },

  // Priority 2 — secondary panels, still enabled
  'ai-industry-tracker': { name: 'AI Industry Tracker', enabled: true, priority: 2 },
  ai: { name: 'AI/ML News', enabled: true, priority: 2 },
  tech: { name: 'Technology', enabled: true, priority: 2 },
  bonds: { name: 'Fixed Income', enabled: true, priority: 2 },
  centralbanks: { name: 'Central Bank Watch', enabled: true, priority: 2 },
  economic: { name: 'Economic Indicators', enabled: true, priority: 2 },
  heatmap: { name: 'Sector Heatmap', enabled: true, priority: 2 },
  'etf-flows': { name: 'BTC ETF Tracker', enabled: true, priority: 2 },
  stablecoins: { name: 'Stablecoins', enabled: true, priority: 2 },
  'dubai-real-estate-radar': { name: 'Dubai Real Estate Radar', enabled: true, priority: 2 },
  'gulf-economies': { name: 'Gulf Economies', enabled: true, priority: 2 },
  'gcc-investments': { name: 'GCC Investments', enabled: true, priority: 2 },
  gccNews: { name: 'GCC Business News', enabled: true, priority: 2 },
  uaeBusiness: { name: 'UAE Business Intel', enabled: true, priority: 2 },
  investmentIntel: { name: 'Deal Flow & SWF', enabled: true, priority: 2 },
  aiResearch: { name: 'AI Research & Labs', enabled: true, priority: 2 },
  startups: { name: 'Startups & VC', enabled: true, priority: 2 },
  thinktanks: { name: 'Think Tanks', enabled: true, priority: 2 },
  finance: { name: 'Financial News', enabled: true, priority: 2 },
  'supply-chain': { name: 'Supply Chain', enabled: true, priority: 2 },
  'telegram-intel': { name: 'Telegram Intel', enabled: true, priority: 2 },
  'security-advisories': { name: 'Security Advisories', enabled: true, priority: 2 },
  'world-clock': { name: 'World Clock', enabled: true, priority: 2 },
  monitors: { name: 'My Monitors', enabled: true, priority: 2 },
};

// Map layers — finance base + geopolitical conflicts/hotspots
export const DEFAULT_MAP_LAYERS: MapLayers = {
  // Geopolitical risk
  conflicts: true,
  hotspots: true,
  sanctions: true,
  military: true,
  ciiChoropleth: true,
  // Finance & commodities
  stockExchanges: true,
  financialCenters: true,
  centralBanks: true,
  commodityHubs: true,
  gulfInvestments: true,
  tradeRoutes: true,
  economic: true,
  // Infrastructure
  cables: true,
  pipelines: true,
  waterways: true,
  outages: true,
  datacenters: true,
  // Tech ecosystem
  startupHubs: true,
  techHQs: true,
  // Environmental & other enabled
  weather: true,
  natural: true,
  cyberThreats: true,
  minerals: true,
  dayNight: true,
  // Disabled
  iranAttacks: false,
  bases: false,
  nuclear: false,
  irradiators: false,
  spaceports: false,
  ais: false,
  flights: false,
  protests: false,
  gpsJamming: false,
  fires: false,
  ucdpEvents: false,
  displacement: false,
  climate: false,
  cloudRegions: false,
  accelerators: false,
  techEvents: false,
  positiveEvents: false,
  kindness: false,
  happiness: false,
  speciesRecovery: false,
  renewableInstallations: false,
};

// Mobile defaults — key layers only to avoid performance issues
export const MOBILE_DEFAULT_MAP_LAYERS: MapLayers = {
  // Geopolitical risk (essential on mobile)
  conflicts: true,
  hotspots: true,
  sanctions: true,
  military: true,
  ciiChoropleth: true,
  // Finance (core only)
  stockExchanges: true,
  centralBanks: true,
  commodityHubs: true,
  economic: true,
  tradeRoutes: false,
  financialCenters: false,
  gulfInvestments: false,
  // Infrastructure (minimal)
  outages: true,
  natural: true,
  waterways: true,
  // Everything else off on mobile
  cables: false,
  pipelines: false,
  datacenters: false,
  startupHubs: false,
  techHQs: false,
  weather: false,
  cyberThreats: false,
  minerals: false,
  dayNight: false,
  iranAttacks: false,
  bases: false,
  nuclear: false,
  irradiators: false,
  spaceports: false,
  ais: false,
  flights: false,
  protests: false,
  gpsJamming: false,
  fires: false,
  ucdpEvents: false,
  displacement: false,
  climate: false,
  cloudRegions: false,
  accelerators: false,
  techEvents: false,
  positiveEvents: false,
  kindness: false,
  happiness: false,
  speciesRecovery: false,
  renewableInstallations: false,
};

export const VARIANT_CONFIG: VariantConfig = {
  name: 'operator',
  description: 'Unified command center — trading, geopolitics, AI/tech, and UAE/GCC intelligence',
  panels: DEFAULT_PANELS,
  mapLayers: DEFAULT_MAP_LAYERS,
  mobileMapLayers: MOBILE_DEFAULT_MAP_LAYERS,
};
