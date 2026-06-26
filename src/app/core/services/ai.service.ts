import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChatRequest,
  ChatResponse,
  ChatTurn,
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
} from '../models/ai.models';

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

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      onToken(decoder.decode(value, { stream: true }));
    }

    const rest = decoder.decode();
    if (rest) {
      onToken(rest);
    }
  }
}
