// HttpClient: gọi REST API, trả Observable (phù hợp JSON một lần)
import { HttpClient } from '@angular/common/http';
// inject(): cách inject dependency mới của Angular (không cần constructor)
import { inject, Injectable } from '@angular/core';
// Observable: luồng dữ liệu bất đồng bộ từ HttpClient
import { Observable } from 'rxjs';
// environment chứa apiBaseUrl = http://localhost:5296/api/ai
import { environment } from '../../../environments/environment';
import {
  ChatRequest,
  ChatResponse,
  PredictRequest,
  PredictResponse,
} from '../models/ai.models';

// providedIn: 'root' = singleton toàn app, chỉ tạo 1 instance
@Injectable({ providedIn: 'root' })
export class AiService {
  // inject HttpClient — Angular tự cung cấp vì đã có provideHttpClient() trong app.config
  private readonly http = inject(HttpClient);

  // URL gốc của API AI Backend (không có /predict hay /chat ở cuối)
  private readonly baseUrl = environment.apiBaseUrl;

  /**
   * Gọi POST /api/ai/predict
   * Frontend gửi: { size: number, bedrooms: number }
   * Backend trả: { predictedPrice, currency, message }
   */
  predict(request: PredictRequest): Observable<PredictResponse> {
    return this.http.post<PredictResponse>(`${this.baseUrl}/predict`, request);
  }

  /**
   * Gọi POST /api/ai/chat (trả JSON đầy đủ, không stream)
   * Frontend gửi: { message: string }
   * Backend trả: { reply: string, isMock: boolean }
   */
  chat(request: ChatRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.baseUrl}/chat`, request);
  }

  /**
   * Gọi POST /api/ai/chat/stream — nhận token realtime.
   *
   * Vì sao dùng fetch thay vì HttpClient?
   * - HttpClient chờ response hoàn chỉnh rồi mới trả.
   * - fetch + response.body.getReader() đọc từng chunk ngay khi Backend gửi.
   *
   * @param request - { message, stream?: true }
   * @param onToken - callback gọi mỗi khi nhận được 1 đoạn text mới
   */
  async streamChat(
    request: ChatRequest,
    onToken: (token: string) => void,
  ): Promise<void> {
    // Gửi POST tới endpoint stream của Backend
    const response = await fetch(`${this.baseUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Backend đọc body JSON
      },
      body: JSON.stringify({ ...request, stream: true }),
    });

    // response.ok = status 200-299; response.body = ReadableStream
    if (!response.ok || !response.body) {
      throw new Error('Không thể mở stream chat từ Backend.');
    }

    // reader: đọc stream theo từng chunk byte
    const reader = response.body.getReader();

    // decoder: chuyển Uint8Array → chuỗi UTF-8 (tiếng Việt)
    const decoder = new TextDecoder('utf-8');

    // Vòng lặp đọc đến khi stream kết thúc
    while (true) {
      const { done, value } = await reader.read();

      // done = true → Backend đã gửi hết token
      if (done) {
        break;
      }

      // stream: true = chunk có thể cắt giữa ký tự UTF-8, decoder sẽ giữ state
      onToken(decoder.decode(value, { stream: true }));
    }

    // Giải mã phần byte còn sót trong buffer decoder
    const rest = decoder.decode();
    if (rest) {
      onToken(rest);
    }
  }
}
