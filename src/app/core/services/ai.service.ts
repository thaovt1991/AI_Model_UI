import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChatRequest,
  ChatResponse,
  PredictRequest,
  PredictResponse,
} from '../models/ai.models';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Gọi POST /api/ai/predict — dự đoán giá nhà bằng ML.NET */
  predict(request: PredictRequest): Observable<PredictResponse> {
    return this.http.post<PredictResponse>(`${this.baseUrl}/predict`, request);
  }

  /** Gọi POST /api/ai/chat — chat với LLM local qua LLamaSharp */
  chat(request: ChatRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.baseUrl}/chat`, request);
  }

  /**
   * Gọi POST /api/ai/chat/stream bằng fetch để đọc ReadableStream.
   * HttpClient phù hợp cho JSON response, còn fetch giúp nhận token realtime.
   */
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
