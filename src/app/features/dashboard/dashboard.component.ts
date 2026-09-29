import { AfterViewInit, Component, computed, HostListener, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../core/services/ai.service';
import {
  DashboardTab,
  LottoGameInfo,
  LottoGameKind,
  DaiPredictionResult,
  LotteryRecord,
  LottoHistoryResponse,
  LottoLoGanResponse,
  MinhNgocScrapeSettingsResponse,
  CoinInfo,
  CoinForecastResponse,
} from '../../core/models/ai.models';
import { ChatComponent } from '../chat/chat.component';
import { CoinChartComponent, CoinChartMode } from './coin-chart.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, ChatComponent, CoinChartComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements AfterViewInit {
  private readonly aiService = inject(AiService);

  readonly activeTab = signal<DashboardTab>('chat');

  readonly size = signal(85);
  readonly bedrooms = signal(3);
  readonly lottoGameTab = signal<LottoGameKind>('xs-mien-bac');
  readonly lottoGames = signal<LottoGameInfo[]>([]);
  readonly lottoDaiByKind = signal<Record<string, string>>({
    'xs-mien-bac': 'ha-noi',
    'xs-mien-nam': 'hcm',
    'xs-mien-trung': 'da-nang',
  });
  readonly lottoMultiDaiByKind = signal<Record<string, string[]>>({
    'xs-mien-nam': ['hcm'],
    'xs-mien-trung': ['da-nang'],
  });
  readonly lottoHistory = signal<LottoHistoryResponse | null>(null);
  readonly lottoLoGan = signal<LottoLoGanResponse | null>(null);
  readonly lottoHistoryLoading = signal(false);
  readonly lottoLoGanLoading = signal(false);
  readonly lottoHistoryFrom = signal(DashboardComponent.isoDateOffset(-30));
  readonly lottoHistoryTo = signal(DashboardComponent.isoDateOffset(0));
  readonly lottoHistoryDate = signal('');
  readonly lottoSubTab = signal<'predict' | 'history' | 'logan'>('predict');
  readonly lottoResults = signal<Record<string, DaiPredictionResult>>({});
  readonly lottoLatestByKey = signal<Record<string, LotteryRecord | null>>({});
  readonly lottoErrors = signal<Record<string, string>>({});
  readonly lottoLoadingKey = signal<string | null>(null);

  readonly scrapeSettingsModalOpen = signal(false);
  readonly scrapeSettingsSaving = signal(false);
  readonly scrapeSettingsError = signal<string | null>(null);
  readonly scrapeEnabledDraft = signal(true);
  readonly scrapeRequestDelayDraft = signal(800);
  readonly scrapeCacheMinutesDraft = signal(30);
  readonly scrapeMaxHistoryDraft = signal(50);
  readonly scrapeMaxLatestProbeDraft = signal(3);
  readonly scrapePreferLocalDraft = signal(true);

  /* --- Coin forecast (dưới panel xổ số) --- */
  readonly coinCatalog = signal<CoinInfo[]>([]);
  readonly coinSymbol = signal('BTC');
  /** Từ khóa search trong danh sách coin (symbol / name / pair) */
  readonly coinSearch = signal('');
  readonly coinPickerOpen = signal(false);
  readonly coinInterval = signal('1h');
  readonly coinLookback = signal(500);
  readonly coinLoading = signal(false);
  readonly coinError = signal<string | null>(null);
  readonly coinResult = signal<CoinForecastResponse | null>(null);
  readonly coinChartMode = signal<CoinChartMode>('candle');
  readonly coinCatalogLoading = signal(false);

  readonly activeLottoGame = computed(() =>
    this.lottoGames().find((g) => g.kind === this.lottoGameTab()),
  );

  readonly activeCoin = computed(() =>
    this.coinCatalog().find(
      (c) => c.symbol.toUpperCase() === this.coinSymbol().toUpperCase(),
    ) ?? null,
  );

  /** Lọc catalog theo ô search — tối đa 80 kết quả để dropdown nhẹ */
  readonly filteredCoinCatalog = computed(() => {
    const q = this.coinSearch().trim().toLowerCase();
    const all = this.coinCatalog();
    const matched = !q
      ? all
      : all.filter((c) => {
          const hay = `${c.symbol} ${c.name} ${c.binancePair}`.toLowerCase();
          return hay.includes(q);
        });
    return matched.slice(0, 80);
  });

  readonly coinCatalogCountLabel = computed(() => {
    const total = this.coinCatalog().length;
    const shown = this.filteredCoinCatalog().length;
    const q = this.coinSearch().trim();
    if (!total) {
      return 'Chưa có danh sách';
    }
    if (!q) {
      return `${total} coin · gõ để tìm`;
    }
    return `Hiện ${shown}/${total} khớp “${q}”`;
  });

  readonly coinChangeClass = computed(() => {
    const r = this.coinResult();
    if (!r) {
      return '';
    }
    if (r.predictedChangePct > 0.15) {
      return 'coin-change--up';
    }
    if (r.predictedChangePct < -0.15) {
      return 'coin-change--down';
    }
    return 'coin-change--flat';
  });

  readonly predictLoading = signal(false);
  readonly predictError = signal<string | null>(null);
  readonly predictedPrice = signal<number | null>(null);
  readonly predictMessage = signal<string | null>(null);

  readonly formattedPrice = computed(() => {
    const price = this.predictedPrice();
    if (price === null) {
      return null;
    }
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  });

  ngAfterViewInit(): void {
    this.loadLottoGames();
  }

  setTab(tab: DashboardTab): void {
    this.activeTab.set(tab);
    if (tab === 'predict') {
      this.loadLottoGames();
      this.loadScrapeSettings();
    }
    if (tab === 'coin') {
      this.loadCoinCatalog();
    }
  }

  loadCoinCatalog(): void {
    this.coinCatalogLoading.set(true);
    this.aiService.getCoinCatalog().subscribe({
      next: (list) => {
        this.coinCatalog.set(list);
        this.coinCatalogLoading.set(false);
        if (list.length && !list.some((c) => c.symbol === this.coinSymbol())) {
          this.coinSymbol.set(list[0].symbol);
        }
      },
      error: () => {
        this.coinCatalogLoading.set(false);
        this.coinError.set('Không tải được danh sách coin từ Binance/Backend.');
      },
    });
  }

  openCoinPicker(): void {
    this.coinPickerOpen.set(true);
    // Prefill search bằng symbol đang chọn để dễ sửa
    if (!this.coinSearch().trim()) {
      this.coinSearch.set('');
    }
  }

  closeCoinPicker(): void {
    this.coinPickerOpen.set(false);
  }

  onCoinSearchInput(value: string): void {
    this.coinSearch.set(value);
    this.coinPickerOpen.set(true);
  }

  selectCoin(symbol: string): void {
    this.coinSymbol.set(symbol);
    this.coinSearch.set('');
    this.coinPickerOpen.set(false);
  }

  onCoinSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeCoinPicker();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const first = this.filteredCoinCatalog()[0];
      if (first) {
        this.selectCoin(first.symbol);
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.coinPickerOpen()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('.coin-picker')) {
      return;
    }
    this.closeCoinPicker();
  }

  onRunCoinForecast(): void {
    if (this.coinLoading()) {
      return;
    }

    this.coinLoading.set(true);
    this.coinError.set(null);

    this.aiService
      .runCoinForecast({
        symbol: this.coinSymbol(),
        interval: this.coinInterval(),
        lookback: this.coinLookback(),
      })
      .subscribe({
        next: (res) => {
          this.coinResult.set(res);
          this.coinLoading.set(false);
        },
        error: (err) => {
          const msg =
            err?.error?.message ??
            'Không chạy được dự đoán coin. Kiểm tra Backend và kết nối Binance.';
          this.coinError.set(msg);
          this.coinLoading.set(false);
        },
      });
  }

  formatUsd(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 6;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: digits,
    }).format(value);
  }

  formatPct(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(3)}%`;
  }

  /** Giải thích ngắn theo kết quả dự đoán — hiện dưới chart */
  coinExplain(r: CoinForecastResponse): string {
    const conf = Math.round(r.confidence * 100);
    const move =
      r.direction === 'Tăng'
        ? `mô hình nghiêng về hướng tăng khoảng ${this.formatPct(r.predictedChangePct)}`
        : r.direction === 'Giảm'
          ? `mô hình nghiêng về hướng giảm khoảng ${this.formatPct(r.predictedChangePct)}`
          : `mô hình thấy biến động nhỏ (đi ngang), khoảng ${this.formatPct(r.predictedChangePct)}`;

    return (
      `Nến vàng bên phải là dự báo cho nến ${r.interval} kế tiếp: giá mục tiêu ` +
      `${this.formatUsd(r.predictedClose)} (độ tin cậy ~${conf}%). ` +
      `Hiện tại ${this.formatUsd(r.lastClose)} — ${move}. ` +
      `Đường vàng bám đỉnh các nến rồi hướng lên. Mũi tên vàng là đỉnh dự báo nến kế. Chấm xanh = hỗ trợ, chấm đỏ = kháng cự. ` +
      `Ensemble: FastTree GBDT (${r.breakdown?.lightGbmWeight ?? 0.7}) + ` +
      `SSA (${r.breakdown?.ssaWeight ?? 0.3}) — chỉ mang tính thống kê ngắn hạn.`
    );
  }

  loadScrapeSettings(): void {
    this.aiService.getMinhNgocScrapeSettings().subscribe({
      next: (res) => this.applyScrapeSettingsDraft(res),
      error: () => {
        // Giữ giá trị draft mặc định nếu API chưa sẵn sàng
      },
    });
  }

  openScrapeSettingsModal(): void {
    this.scrapeSettingsError.set(null);
    this.scrapeSettingsModalOpen.set(true);
    this.loadScrapeSettings();
  }

  closeScrapeSettingsModal(): void {
    this.scrapeSettingsModalOpen.set(false);
  }

  saveScrapeSettings(): void {
    this.scrapeSettingsSaving.set(true);
    this.scrapeSettingsError.set(null);

    this.aiService
      .updateMinhNgocScrapeSettings({
        scrapingEnabled: this.scrapeEnabledDraft(),
        requestDelayMs: this.scrapeRequestDelayDraft(),
        cacheMinutes: this.scrapeCacheMinutesDraft(),
        maxHistoryFetchesPerRun: this.scrapeMaxHistoryDraft(),
        maxLatestProbeAttempts: this.scrapeMaxLatestProbeDraft(),
        preferLocalDataFirst: this.scrapePreferLocalDraft(),
      })
      .subscribe({
        next: (res) => {
          this.applyScrapeSettingsDraft(res);
          this.scrapeSettingsSaving.set(false);
          this.closeScrapeSettingsModal();
        },
        error: () => {
          this.scrapeSettingsError.set('Không lưu được cài đặt cào dữ liệu.');
          this.scrapeSettingsSaving.set(false);
        },
      });
  }

  private applyScrapeSettingsDraft(res: MinhNgocScrapeSettingsResponse): void {
    this.scrapeEnabledDraft.set(res.scrapingEnabled);
    this.scrapeRequestDelayDraft.set(res.requestDelayMs);
    this.scrapeCacheMinutesDraft.set(res.cacheMinutes);
    this.scrapeMaxHistoryDraft.set(res.maxHistoryFetchesPerRun);
    this.scrapeMaxLatestProbeDraft.set(res.maxLatestProbeAttempts);
    this.scrapePreferLocalDraft.set(res.preferLocalDataFirst);
  }

  loadLottoGames(): void {
    if (this.lottoGames().length > 0) {
      return;
    }

    this.aiService.getLottoGames().subscribe({
      next: (games) => {
        this.lottoGames.set(games);
        for (const game of games) {
          if (game.requiresDai) {
            const dai = this.selectedDaiFor(game.kind) ?? game.daiList[0]?.code;
            if (dai) {
              this.lottoDaiByKind.update((m) => ({ ...m, [game.kind]: dai }));
              if (this.isMultiSelectRegion(game.kind)) {
                this.lottoMultiDaiByKind.update((m) => ({
                  ...m,
                  [game.kind]: m[game.kind]?.length ? m[game.kind] : [dai],
                }));
                this.loadLottoLatestForDais(
                  game.kind as LottoGameKind,
                  this.resolvePredictDaiCodes(game),
                );
              } else {
                this.loadLottoLatest(game.kind as LottoGameKind, dai);
              }
            }
          } else {
            this.loadLottoLatest(game.kind as LottoGameKind);
          }
        }
      },
      error: () => {
        this.lottoGames.set([
          {
            kind: 'xs-mien-bac',
            title: 'XS Kiến thiết — Miền Bắc',
            subtitle: 'Giải đặc biệt',
            description: 'Dự báo giải đặc biệt XSMB',
            requiresDai: false,
            daiList: [],
          },
        ]);
      },
    });
  }

  selectLottoGame(kind: LottoGameKind): void {
    this.lottoGameTab.set(kind);
    const game = this.lottoGames().find((g) => g.kind === kind);
    if (!game) {
      return;
    }
    if (this.isVietlott(kind)) {
      this.loadLottoLatest(kind);
      return;
    }
    const dai = game.requiresDai
      ? this.selectedDaiFor(game.kind) ?? game.daiList[0]?.code
      : undefined;
    if (game.requiresDai && this.isMultiSelectRegion(kind)) {
      this.loadLottoLatestForDais(kind, this.resolvePredictDaiCodes(game));
    } else {
      this.loadLottoLatest(kind, dai);
    }
  }

  selectLottoDai(kind: LottoGameKind, daiCode: string): void {
    this.lottoDaiByKind.update((map) => ({ ...map, [kind]: daiCode }));
    this.loadLottoLatest(kind, daiCode);
    if (this.lottoSubTab() === 'logan') {
      this.loadLoGan(kind, daiCode);
    }
  }

  selectLottoSubTab(tab: 'predict' | 'history' | 'logan'): void {
    this.lottoSubTab.set(tab);
    const game = this.activeLottoGame();
    if (!game) {
      return;
    }
    const dai = game.requiresDai ? this.selectedDaiFor(game.kind) : undefined;
    if (tab === 'logan') {
      this.loadLoGan(game.kind as LottoGameKind, dai);
    }
  }

  loadLottoHistory(game: LottoGameInfo): void {
    const daiCode = game.requiresDai ? this.selectedDaiFor(game.kind) : undefined;
    this.lottoHistoryLoading.set(true);
    this.aiService
      .getLottoHistory({
        gameKind: game.kind,
        daiCode: daiCode ?? null,
        fromDate: this.lottoHistoryDate()
          ? null
          : this.formatIsoToApiDate(this.lottoHistoryFrom()),
        toDate: this.lottoHistoryDate()
          ? null
          : this.formatIsoToApiDate(this.lottoHistoryTo()),
        date: this.lottoHistoryDate()
          ? this.formatIsoToApiDate(this.lottoHistoryDate())
          : null,
      })
      .subscribe({
        next: (res) => {
          this.lottoHistory.set(res);
          this.lottoHistoryLoading.set(false);
        },
        error: () => {
          this.lottoHistory.set(null);
          this.lottoHistoryLoading.set(false);
        },
      });
  }

  loadLoGan(kind: LottoGameKind, daiCode?: string): void {
    this.lottoLoGanLoading.set(true);
    this.aiService.getLottoLoGan(kind, daiCode, 30).subscribe({
      next: (res) => {
        this.lottoLoGan.set(res);
        this.lottoLoGanLoading.set(false);
      },
      error: () => {
        this.lottoLoGan.set(null);
        this.lottoLoGanLoading.set(false);
      },
    });
  }

  isMienBac(kind: string): boolean {
    return kind === 'xs-mien-bac';
  }

  isVietlott(kind: string): boolean {
    return kind === 'vietlott-645' || kind === 'vietlott-655';
  }

  isMultiSelectRegion(kind: string): boolean {
    return kind === 'xs-mien-nam' || kind === 'xs-mien-trung';
  }

  selectedDaisFor(kind: string): string[] {
    if (this.isMultiSelectRegion(kind)) {
      const multi = this.lottoMultiDaiByKind()[kind];
      if (multi?.length) {
        return multi;
      }
    }
    const single = this.selectedDaiFor(kind);
    return single ? [single] : [];
  }

  /** Đài dùng khi bấm dự đoán — luôn có fallback từ chip đang chọn / mặc định. */
  resolvePredictDaiCodes(game: LottoGameInfo): string[] {
    if (this.isVietlott(game.kind) || !game.requiresDai) {
      return [];
    }

    const fallback = this.selectedDaiFor(game.kind) ?? game.daiList[0]?.code;
    if (!fallback) {
      return [];
    }

    if (this.isMultiSelectRegion(game.kind)) {
      const multi = this.lottoMultiDaiByKind()[game.kind];
      if (multi?.length) {
        return multi;
      }
      return [fallback];
    }

    return [fallback];
  }

  isDaiSelected(kind: string, daiCode: string): boolean {
    return this.selectedDaisFor(kind).includes(daiCode);
  }

  isAllDaisSelected(kind: string, game: LottoGameInfo): boolean {
    const selected = this.selectedDaisFor(kind);
    return game.daiList.length > 0 && selected.length === game.daiList.length;
  }

  toggleAllDais(kind: LottoGameKind, game: LottoGameInfo): void {
    if (this.isAllDaisSelected(kind, game)) {
      const keep = this.selectedDaiFor(kind) ?? game.daiList[0]?.code;
      this.lottoMultiDaiByKind.update((m) => ({
        ...m,
        [kind]: keep ? [keep] : [],
      }));
      if (keep) {
        this.loadLottoLatestForDais(kind, [keep]);
      }
      return;
    }

    const allCodes = game.daiList.map((d) => d.code);
    this.lottoMultiDaiByKind.update((m) => ({
      ...m,
      [kind]: allCodes,
    }));
    this.loadLottoLatestForDais(kind, allCodes);
  }

  toggleLottoDaiSelection(kind: LottoGameKind, daiCode: string, game: LottoGameInfo): void {
    if (!this.isMultiSelectRegion(kind)) {
      this.selectLottoDai(kind, daiCode);
      return;
    }

    const current = [...(this.lottoMultiDaiByKind()[kind] ?? [])];
    const idx = current.indexOf(daiCode);
    if (idx >= 0) {
      if (current.length > 1) {
        current.splice(idx, 1);
      }
    } else {
      current.push(daiCode);
    }

    this.lottoMultiDaiByKind.update((m) => ({ ...m, [kind]: current }));
    this.lottoDaiByKind.update((map) => ({ ...map, [kind]: daiCode }));
    this.loadLottoLatestForDais(kind, current);
    if (this.lottoSubTab() === 'logan') {
      this.loadLoGan(kind, daiCode);
    }
  }

  loadLottoLatestForDais(kind: LottoGameKind, daiCodes: string[]): void {
    for (const code of daiCodes) {
      this.loadLottoLatest(kind, code);
    }
  }

  resolveDaiName(game: LottoGameInfo, daiCode: string): string {
    return game.daiList.find((d) => d.code === daiCode)?.name ?? daiCode;
  }

  selectedDaiFor(kind: string): string | undefined {
    return this.lottoDaiByKind()[kind];
  }

  lottoResultKey(kind: string, daiCode?: string): string {
    return daiCode ? `${kind}:${daiCode}` : kind;
  }

  lottoLatestFor(kind: string, daiCode?: string): LotteryRecord | null {
    return this.lottoLatestByKey()[this.lottoResultKey(kind, daiCode)] ?? null;
  }

  lottoResultFor(kind: string, daiCode?: string): DaiPredictionResult | null {
    return this.lottoResults()[this.lottoResultKey(kind, daiCode)] ?? null;
  }

  lottoErrorFor(kind: string, daiCode?: string): string | null {
    return this.lottoErrors()[this.lottoResultKey(kind, daiCode)] ?? null;
  }

  isLottoLoading(kind: string, daiCode?: string): boolean {
    return this.lottoLoadingKey() === this.lottoResultKey(kind, daiCode);
  }

  isPredictLoading(game: LottoGameInfo): boolean {
    return this.lottoLoadingKey() === this.predictLoadingKeyFor(game);
  }

  predictLoadingKeyFor(game: LottoGameInfo): string {
    const selected = this.resolvePredictDaiCodes(game);
    if (this.isMultiSelectRegion(game.kind) && selected.length > 1) {
      return `${game.kind}:multi`;
    }
    return this.lottoResultKey(game.kind, selected[0] ?? this.selectedDaiFor(game.kind));
  }

  formatVietlottNumbers(nums: number[] | undefined | null, kind?: string): string {
    if (!nums?.length) {
      return '—';
    }
    if (kind === 'vietlott-655' && nums.length >= 7) {
      const main = nums
        .slice(0, 6)
        .map((n) => n.toString().padStart(2, '0'))
        .join(' - ');
      return `${main} | Power: ${nums[6].toString().padStart(2, '0')}`;
    }
    return nums.map((n) => n.toString().padStart(2, '0')).join(' - ');
  }

  formatLottoNumbers(nums: number[], gameKind: string): string {
    if (gameKind === 'xs-mien-bac') {
      return nums.join('');
    }
    return nums.map((n) => n.toString().padStart(2, '0')).join(' · ');
  }

  formatLoVe(nums: number[] | undefined | null): string {
    if (!nums?.length) {
      return '—';
    }
    return [...new Set(nums)]
      .sort((a, b) => a - b)
      .map((n) => n.toString().padStart(2, '0'))
      .join(' · ');
  }

  countLoVe(nums: number[] | undefined | null): number {
    return nums?.length ?? 0;
  }

  private formatIsoToApiDate(iso: string): string | null {
    if (!iso) {
      return null;
    }
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) {
      return null;
    }
    return `${d}/${m}/${y}`;
  }

  private static isoDateOffset(dayDelta: number): string {
    const d = new Date();
    d.setDate(d.getDate() + dayDelta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  formatGiaiDacBiet(digits: number[] | undefined | null): string {
    if (!digits?.length) {
      return '—';
    }
    return digits.join('');
  }

  loadLottoLatest(kind: LottoGameKind, daiCode?: string): void {
    const key = this.lottoResultKey(kind, daiCode);
    this.aiService.getLottoLatest(kind, daiCode).subscribe({
      next: (res) => {
        this.lottoLatestByKey.update((m) => ({ ...m, [key]: res.latest ?? null }));
      },
      error: () => {
        this.lottoLatestByKey.update((m) => ({ ...m, [key]: null }));
      },
    });
  }

  /** Gắn kết quả vào đài user chọn — MB backend trả tên đài kỳ tới, không phải đài đang xem. */
  private resolveStoredDaiCode(
    game: LottoGameInfo,
    item: DaiPredictionResult,
    requestedCodes: string[],
    index: number,
    responseDaiCode?: string | null,
  ): string | undefined {
    if (!game.requiresDai) {
      return undefined;
    }

    if (this.isMienBac(game.kind)) {
      return requestedCodes[index] ?? responseDaiCode ?? requestedCodes[0];
    }

    const byName = game.daiList.find(
      (d) => d.name === item.dai || d.name.localeCompare(item.dai, 'vi') === 0,
    )?.code;

    return byName ?? requestedCodes[index] ?? responseDaiCode ?? undefined;
  }

  onRunLottoForecast(game: LottoGameInfo, mbActiveDaiCode?: string): void {
    const daiCodes =
      this.isMienBac(game.kind) && mbActiveDaiCode
        ? [mbActiveDaiCode]
        : this.resolvePredictDaiCodes(game);

    if (!this.isVietlott(game.kind) && daiCodes.length === 0) {
      return;
    }

    const loadingKey = this.predictLoadingKeyFor(game);
    this.lottoLoadingKey.set(loadingKey);
    this.lottoErrors.update((m) => {
      const next = { ...m };
      delete next[loadingKey];
      for (const code of daiCodes) {
        delete next[this.lottoResultKey(game.kind, code)];
      }
      if (this.isVietlott(game.kind)) {
        delete next[this.lottoResultKey(game.kind)];
      }
      return next;
    });

    this.aiService
      .runLottoForecast({
        gameKind: game.kind as LottoGameKind,
        daiCode: daiCodes.length === 1 ? daiCodes[0] : null,
        daiCodes: daiCodes.length > 1 ? daiCodes : null,
        predictAllDais:
          this.isMultiSelectRegion(game.kind) && this.isAllDaisSelected(game.kind, game),
      })
      .subscribe({
        next: (res) => {
          const results = res.allDais ?? (res.single ? [res.single] : []);

          for (let i = 0; i < results.length; i++) {
            const item = results[i];
            const daiCode = this.resolveStoredDaiCode(game, item, daiCodes, i, res.daiCode);

            if (game.requiresDai && !daiCode) {
              continue;
            }

            const key = this.lottoResultKey(game.kind, daiCode);
            const storedItem: DaiPredictionResult =
              this.isMienBac(game.kind) && daiCode
                ? { ...item, dai: this.resolveDaiName(game, daiCode) }
                : item;
            this.lottoResults.update((m) => ({ ...m, [key]: storedItem }));
            this.lottoLatestByKey.update((m) => ({
              ...m,
              [key]: {
                dai:
                  this.isMienBac(game.kind) && daiCode
                    ? this.resolveDaiName(game, daiCode)
                    : item.dai,
                ngayQuay: item.ngayQuayTruoc,
                kyQuay: item.kyQuayTruoc,
                cacSoDaVe: item.ketQuaKyTruoc,
                giaiDacBietSo: item.ketQuaGiaiDacBietTruoc?.length
                  ? item.ketQuaGiaiDacBietTruoc
                  : undefined,
                tatCaLoVe: item.tatCaLoVeKyTruoc,
              },
            }));
            this.loadLottoLatest(
              game.kind as LottoGameKind,
              this.isVietlott(game.kind) ? undefined : daiCode,
            );
          }

          this.lottoLoadingKey.set(null);
        },
        error: (err) => {
          this.lottoErrors.update((m) => ({
            ...m,
            [loadingKey]: err.error?.message ?? 'Không chạy được dự đoán.',
          }));
          this.lottoLoadingKey.set(null);
        },
      });
  }

  onPredict(): void {
    this.predictLoading.set(true);
    this.predictError.set(null);
    this.predictedPrice.set(null);
    this.predictMessage.set(null);

    this.aiService
      .predict({ size: this.size(), bedrooms: this.bedrooms() })
      .subscribe({
        next: (res) => {
          this.predictedPrice.set(res.predictedPrice);
          this.predictMessage.set(res.message);
          this.predictLoading.set(false);
        },
        error: () => {
          this.predictError.set(
            'Không gọi được API dự đoán. Kiểm tra Backend đang chạy.',
          );
          this.predictLoading.set(false);
        },
      });
  }
}
