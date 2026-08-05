export interface PredictRequest {
  size: number;
  bedrooms: number;
}

export interface PredictResponse {
  predictedPrice: number;
  currency: string;
  message: string;
}

export interface LotteryRecord {
  dai: string;
  ngayQuay: string;
  kyQuay: number;
  cacSoDaVe: number[];
  giaiDacBietSo?: number[];
  tatCaLoVe?: number[];
}

export interface DaiPredictionResult {
  dai: string;
  kyQuayTruoc: number;
  ngayQuayTruoc: string;
  ketQuaKyTruoc: number[];
  kyQuayDuDoan: number;
  ngayQuayDuKien?: string | null;
  cacSoDuDoanKyTiep: number[];
  cacSoDuDoanLamTron: number[];
  ketQuaTruocDinhDang: string;
  ketQuaDuDoanDinhDang: string;
  ketQuaGiaiDacBietTruoc?: number[];
  tatCaLoVeKyTruoc?: number[];
  duDoanGiaiDacBiet?: number[];
  giaiDacBietTruocDinhDang?: string;
  giaiDacBietDuDoanDinhDang?: string;
  duDoanLo?: LottoLotoExtras | null;
  soKyDaHoc: number;
  thongBaoLoi?: string | null;
  thanhCong: boolean;
}

export interface LottoLotoExtras {
  bachThuLo?: number | null;
  songThuLo?: number[];
  xien2?: number[];
  xien3?: number[];
  xien4?: number[];
  bachThuLoDinhDang?: string;
  songThuLoDinhDang?: string;
  xien2DinhDang?: string;
  xien3DinhDang?: string;
  xien4DinhDang?: string;
}

export interface LoGanItem {
  so: number;
  soNgayChuaVe: number;
  ganMax: number;
  ngayVeCuoi?: string | null;
  soDinhDang: string;
}

export interface LottoHistoryResponse {
  gameKind: string;
  daiCode?: string | null;
  daiTen: string;
  tuNgay?: string | null;
  denNgay?: string | null;
  tongKy: number;
  records: LotteryRecord[];
}

export interface LottoLoGanResponse {
  gameKind: string;
  daiCode?: string | null;
  daiTen: string;
  soKyPhanTich: number;
  items: LoGanItem[];
}

export interface LottoHistoryQuery {
  gameKind: string;
  daiCode?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  date?: string | null;
}

export interface LottoDaiInfo {
  code: string;
  name: string;
  regionLabel: string;
}

export interface LottoGameInfo {
  kind: string;
  title: string;
  subtitle: string;
  description: string;
  requiresDai: boolean;
  daiList: LottoDaiInfo[];
}

export type LottoGameKind =
  | 'xs-mien-bac'
  | 'xs-mien-nam'
  | 'xs-mien-trung'
  | 'vietlott-645'
  | 'vietlott-655';

export interface LottoRunRequest {
  gameKind: LottoGameKind;
  daiCode?: string | null;
  daiCodes?: string[] | null;
  useSampleIfEmpty?: boolean;
  predictAllDais?: boolean;
}

export interface LottoRunResponse {
  gameKind: string;
  daiCode?: string | null;
  single?: DaiPredictionResult | null;
  allDais?: DaiPredictionResult[] | null;
}

export interface MinhNgocScrapeSettingsResponse {
  scrapingEnabled: boolean;
  requestDelayMs: number;
  cacheMinutes: number;
  maxHistoryFetchesPerRun: number;
  maxLatestProbeAttempts: number;
  preferLocalDataFirst: boolean;
}

export interface UpdateMinhNgocScrapeSettingsRequest {
  scrapingEnabled?: boolean;
  requestDelayMs?: number;
  cacheMinutes?: number;
  maxHistoryFetchesPerRun?: number;
  maxLatestProbeAttempts?: number;
  preferLocalDataFirst?: boolean;
}

export interface LottoLatestResponse {
  gameKind: string;
  daiCode?: string | null;
  latest?: LotteryRecord | null;
}

export interface ChatRequest {
  message: string;
  stream?: boolean;
  documentIds?: string[];
  conversationId?: string;
  profileId?: string;
  /** null/undefined = tự động; true = luôn research; false = tắt */
  enableWebSearch?: boolean | null;
  /** true = Deep Research (nhiều truy vấn + nhiều nguồn) */
  deepResearch?: boolean;
}

export interface ChatResponse {
  reply: string;
  isMock: boolean;
  historyTurns?: number;
  usedWebResearch?: boolean;
  webSourceCount?: number;
  usedDeepResearch?: boolean;
  citations?: CitationSource[];
}

/** Nguồn trích dẫn (tài liệu hoặc web) — khớp CitationSource backend */
export interface CitationSource {
  id: number;
  kind: 'document' | 'web' | string;
  title: string;
  url?: string | null;
  fileName?: string | null;
  chunkIndex?: number | null;
  snippet: string;
  score: number;
  sourceLabel: string;
}

/** Meta xen trong stream: [[AI_META]]{...}[[/AI_META]] */
export interface ChatStreamMeta {
  type: 'status' | 'citations' | 'phase' | string;
  phase?: string | null;
  message?: string | null;
  items?: CitationSource[] | null;
}

export interface ChatTurn {
  userMessage: string;
  assistantReply: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isMock?: boolean;
  /** Trạng thái tạm khi đang research/RAG */
  statusText?: string | null;
  citations?: CitationSource[];
}

export interface DocumentInfo {
  id: string;
  fileName: string;
  sizeBytes: number;
  chunkCount: number;
  preview: string;
  uploadedAt: string;
}

export interface DocumentUploadResponse {
  id: string;
  fileName: string;
  sizeBytes: number;
  chunkCount: number;
  preview: string;
}

export type DashboardTab = 'predict' | 'coin' | 'chat';

export type SettingsModalTab = 'ai' | 'documents' | 'learning' | 'memory';

export interface LearningSettingsResponse {
  enabled: boolean;
  collectData: boolean;
  status: string;
  totalSamples: number;
  pendingSamples: number;
  adapterPath?: string | null;
  adapterVersion: number;
  lastError?: string | null;
  lastTrainUtc?: string | null;
  learnedTopics?: string[];
  lastTrainingMessage?: string | null;
}

export interface UpdateLearningSettingsRequest {
  enabled?: boolean;
  collectData?: boolean;
}

export interface ChatProfileSettingsResponse {
  profileId: string;
  aiName?: string | null;
}

export interface UpdateChatProfileSettingsRequest {
  aiName?: string | null;
}

/* ========== Coin forecast ========== */

export interface CoinInfo {
  symbol: string;
  name: string;
  quote: string;
  binancePair: string;
  description: string;
}

export interface CoinRunRequest {
  symbol: string;
  interval?: string;
  lookback?: number;
}

export interface CoinCandleDto {
  openTimeUtc: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CoinModelBreakdown {
  lightGbmPredictedClose: number;
  ssaPredictedClose: number;
  lightGbmWeight: number;
  ssaWeight: number;
  lightGbmNote: string;
  ssaNote: string;
}

export interface CoinForecastResponse {
  symbol: string;
  name: string;
  interval: string;
  algorithm: string;
  lastCandleUtc: string;
  lastClose: number;
  predictedClose: number;
  predictedChangePct: number;
  direction: string;
  confidence: number;
  support: number;
  resistance: number;
  rsi14: number;
  macdHistogram: number;
  candlesUsed: number;
  message: string;
  recentCandles?: CoinCandleDto[] | null;
  breakdown?: CoinModelBreakdown | null;
}
