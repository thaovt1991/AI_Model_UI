import { HttpClient } from '@angular/common/http';
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
} from '../models/ai.models';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  predict(request: PredictRequest): Observable<PredictResponse> {
    return this.http.post<PredictResponse>(`${this.baseUrl}/predict`, request);
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
