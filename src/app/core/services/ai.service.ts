import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChatRequest,
  ChatResponse,
  ChatTurn,
  ChatStreamMeta,
  DocumentInfo,
  DocumentUploadResponse,
  PredictRequest,
  PredictResponse,
  LearningSettingsResponse,
  UpdateLearningSettingsRequest,
  ChatProfileSettingsResponse,
  UpdateChatProfileSettingsRequest,
  LottoRunRequest,
  LottoRunResponse,
  LottoLatestResponse,
  LottoGameInfo,
  LottoHistoryQuery,
  LottoHistoryResponse,
  LottoLoGanResponse,
  MinhNgocScrapeSettingsResponse,
  UpdateMinhNgocScrapeSettingsRequest,
  CoinInfo,
  CoinRunRequest,
  CoinForecastResponse,
} from '../models/ai.models';

/** Bắt đầu / kết thúc khối meta trong stream text/plain từ Backend */
const META_BEGIN = '[[AI_META]]';
const META_END = '[[/AI_META]]';

/**
 * Parser stream: tách text thường và khối [[AI_META]]...[[/AI_META]].
 * Token có thể bị cắt giữa chừng → giữ buffer đến khi đủ 1 khối meta.
 */
export class ChatStreamMetaParser {
  private buffer = '';

  push(
    chunk: string,
    onText: (text: string) => void,
    onMeta: (meta: ChatStreamMeta) => void,
  ): void {
    this.buffer += chunk;

    while (true) {
      const start = this.buffer.indexOf(META_BEGIN);
      if (start === -1) {
        if (this.buffer.length > 0) {
          onText(this.buffer);
          this.buffer = '';
        }
        return;
      }

      // Text trước meta
      if (start > 0) {
        onText(this.buffer.slice(0, start));
        this.buffer = this.buffer.slice(start);
      }

      const end = this.buffer.indexOf(META_END);
      if (end === -1) {
        // Chưa đủ khối meta — chờ chunk tiếp
        return;
      }

      const json = this.buffer.slice(META_BEGIN.length, end);
      this.buffer = this.buffer.slice(end + META_END.length);
      if (this.buffer.startsWith('\n')) {
        this.buffer = this.buffer.slice(1);
      }

      try {
        onMeta(JSON.parse(json) as ChatStreamMeta);
      } catch {
        // Meta hỏng — bỏ qua, không làm vỡ stream
      }
    }
  }
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  predict(request: PredictRequest): Observable<PredictResponse> {
    return this.http.post<PredictResponse>(`${this.baseUrl}/predict`, request);
  }

  runLottoForecast(request: LottoRunRequest): Observable<LottoRunResponse> {
    return this.http.post<LottoRunResponse>(`${this.baseUrl}/lotto/run`, {
      gameKind: request.gameKind,
      daiCode: request.daiCode ?? undefined,
      daiCodes: request.daiCodes?.length ? request.daiCodes : undefined,
      useSampleIfEmpty: request.useSampleIfEmpty ?? true,
      predictAllDais: request.predictAllDais ?? false,
    });
  }

  getLottoLatest(gameKind: string, daiCode?: string | null): Observable<LottoLatestResponse> {
    let params = new HttpParams().set('gameKind', gameKind);
    if (daiCode) {
      params = params.set('daiCode', daiCode);
    }
    return this.http.get<LottoLatestResponse>(`${this.baseUrl}/lotto/latest`, { params });
  }

  getLottoGames(): Observable<LottoGameInfo[]> {
    return this.http.get<LottoGameInfo[]>(`${this.baseUrl}/lotto/games`);
  }

  getLottoHistory(query: LottoHistoryQuery): Observable<LottoHistoryResponse> {
    let params = new HttpParams().set('gameKind', query.gameKind);
    if (query.daiCode) {
      params = params.set('daiCode', query.daiCode);
    }
    if (query.fromDate) {
      params = params.set('fromDate', query.fromDate);
    }
    if (query.toDate) {
      params = params.set('toDate', query.toDate);
    }
    if (query.date) {
      params = params.set('date', query.date);
    }
    return this.http.get<LottoHistoryResponse>(`${this.baseUrl}/lotto/history`, { params });
  }

  getLottoLoGan(
    gameKind: string,
    daiCode?: string | null,
    top = 30,
  ): Observable<LottoLoGanResponse> {
    let params = new HttpParams().set('gameKind', gameKind).set('top', top);
    if (daiCode) {
      params = params.set('daiCode', daiCode);
    }
    return this.http.get<LottoLoGanResponse>(`${this.baseUrl}/lotto/lo-gan`, { params });
  }

  getMinhNgocScrapeSettings(): Observable<MinhNgocScrapeSettingsResponse> {
    return this.http.get<MinhNgocScrapeSettingsResponse>(`${this.baseUrl}/lotto/scrape-settings`);
  }

  updateMinhNgocScrapeSettings(
    request: UpdateMinhNgocScrapeSettingsRequest,
  ): Observable<MinhNgocScrapeSettingsResponse> {
    return this.http.put<MinhNgocScrapeSettingsResponse>(
      `${this.baseUrl}/lotto/scrape-settings`,
      request,
    );
  }

  getCoinCatalog(): Observable<CoinInfo[]> {
    return this.http.get<CoinInfo[]>(`${this.baseUrl}/coin/catalog`);
  }

  runCoinForecast(request: CoinRunRequest): Observable<CoinForecastResponse> {
    return this.http.post<CoinForecastResponse>(`${this.baseUrl}/coin/run`, {
      symbol: request.symbol,
      interval: request.interval ?? '1h',
      lookback: request.lookback ?? 500,
    });
  }

  chat(request: ChatRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.baseUrl}/chat`, request);
  }

  /** Upload tài liệu nội bộ — multipart/form-data */
  uploadDocument(file: File): Observable<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<DocumentUploadResponse>(
      `${this.baseUrl}/documents/upload`,
      formData,
    );
  }

  /** Danh sách tài liệu đã upload */
  listDocuments(): Observable<DocumentInfo[]> {
    return this.http.get<DocumentInfo[]>(`${this.baseUrl}/documents`);
  }

  /** Xóa tài liệu khỏi kho nội bộ */
  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/documents/${id}`);
  }

  clearChatMemory(profileId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/chat/memory`, {
      params: { profileId },
    });
  }

  getChatMemory(profileId: string, conversationId: string): Observable<ChatTurn[]> {
    return this.http.get<ChatTurn[]>(`${this.baseUrl}/chat/memory`, {
      params: { profileId, conversationId },
    });
  }

  getChatProfile(profileId: string): Observable<ChatProfileSettingsResponse> {
    return this.http.get<ChatProfileSettingsResponse>(`${this.baseUrl}/chat/profile`, {
      params: { profileId },
    });
  }

  updateChatProfile(
    profileId: string,
    request: UpdateChatProfileSettingsRequest,
  ): Observable<ChatProfileSettingsResponse> {
    return this.http.put<ChatProfileSettingsResponse>(`${this.baseUrl}/chat/profile`, request, {
      params: { profileId },
    });
  }

  getLearningSettings(): Observable<LearningSettingsResponse> {
    return this.http.get<LearningSettingsResponse>(`${this.baseUrl}/learning/settings`);
  }

  updateLearningSettings(
    request: UpdateLearningSettingsRequest,
  ): Observable<LearningSettingsResponse> {
    return this.http.put<LearningSettingsResponse>(`${this.baseUrl}/learning/settings`, request);
  }

  async streamChat(
    request: ChatRequest,
    onToken: (token: string) => void,
    onMeta?: (meta: ChatStreamMeta) => void,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok || !response.body) {
      throw new Error('Không thể mở stream chat từ Backend.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const parser = new ChatStreamMetaParser();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      parser.push(
        decoder.decode(value, { stream: true }),
        (text) => {
          if (text) {
            onToken(text);
          }
        },
        (meta) => onMeta?.(meta),
      );
    }

    const rest = decoder.decode();
    if (rest) {
      parser.push(
        rest,
        (text) => {
          if (text) {
            onToken(text);
          }
        },
        (meta) => onMeta?.(meta),
      );
    }
  }
}
