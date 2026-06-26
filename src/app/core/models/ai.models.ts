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
}

export interface ChatResponse {
  reply: string;
  isMock: boolean;
  historyTurns?: number;
}

export interface ChatTurn {
  userMessage: string;
  assistantReply: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isMock?: boolean;
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

export type DashboardTab = 'predict' | 'chat';

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
