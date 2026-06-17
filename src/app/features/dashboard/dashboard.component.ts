import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../core/services/ai.service';
import { ChatMessage, DashboardTab } from '../../core/models/ai.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements AfterViewInit {
  private readonly aiService = inject(AiService);

  @ViewChild('chatMessages')
  private chatMessages?: ElementRef<HTMLDivElement>;

  @ViewChild('chatInputBox')
  private chatInputBox?: ElementRef<HTMLTextAreaElement>;

  // Tab đang chọn trên Dashboard
  readonly activeTab = signal<DashboardTab>('chat');

  // --- ML.NET Predict state ---
  readonly size = signal(85);
  readonly bedrooms = signal(3);
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

  // --- Chat state ---
  readonly chatInput = signal('');
  readonly chatLoading = signal(false);
  readonly chatError = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Xin chào! Tôi là chatbot chạy local qua LLamaSharp. Hãy đặt file .gguf vào Backend để dùng model thật.',
    },
  ]);

  ngAfterViewInit(): void {
    this.focusChatInput();
  }

  setTab(tab: DashboardTab): void {
    this.activeTab.set(tab);
    if (tab === 'chat') {
      this.focusChatInput();
    }
  }

  onPredict(): void {
    this.predictLoading.set(true);
    this.predictError.set(null);
    this.predictedPrice.set(null);
    this.predictMessage.set(null);

    // FE gửi JSON { size, bedrooms } → BE map sang PredictRequest
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
            'Không gọi được API dự đoán. Kiểm tra Backend đang chạy tại http://localhost:5296.',
          );
          this.predictLoading.set(false);
        },
      });
  }

  async onSendChat(): Promise<void> {
    const text = this.chatInput().trim();
    if (!text || this.chatLoading()) {
      return;
    }

    this.messages.update((list) => [
      ...list,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ]);
    this.chatInput.set('');
    this.chatLoading.set(true);
    this.chatError.set(null);
    this.scrollChatToBottom();
    this.focusChatInput();

    // FE gửi { message } → BE stream text/plain từng token qua LLamaSharp.
    try {
      await this.aiService.streamChat({ message: text }, (token) => {
        this.appendToLastAssistantMessage(token);
      });

      this.markMockReplyIfNeeded();
    } catch {
      this.chatError.set(
        'Không mở được stream chat. Kiểm tra Backend và cấu hình CORS.',
      );
      this.replaceLastAssistantMessage(
        'Không thể nhận phản hồi từ Backend. Vui lòng thử lại.',
      );
    } finally {
      this.chatLoading.set(false);
      this.focusChatInput();
    }
  }

  onChatKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendChat();
    }
  }

  private appendToLastAssistantMessage(token: string): void {
    this.messages.update((list) => {
      const next = [...list];
      const lastIndex = next.length - 1;
      const last = next[lastIndex];

      if (!last || last.role !== 'assistant') {
        return list;
      }

      next[lastIndex] = {
        ...last,
        content: `${last.content}${token}`,
      };

      return next;
    });
    this.scrollChatToBottom();
  }

  private replaceLastAssistantMessage(content: string): void {
    this.messages.update((list) => {
      const next = [...list];
      const lastIndex = next.length - 1;
      const last = next[lastIndex];

      if (!last || last.role !== 'assistant') {
        return [...list, { role: 'assistant', content }];
      }

      next[lastIndex] = {
        ...last,
        content,
      };

      return next;
    });
    this.scrollChatToBottom();
  }

  private markMockReplyIfNeeded(): void {
    this.messages.update((list) => {
      const next = [...list];
      const lastIndex = next.length - 1;
      const last = next[lastIndex];

      if (!last || last.role !== 'assistant') {
        return list;
      }

      next[lastIndex] = {
        ...last,
        isMock: last.content.startsWith('[Chế độ mock'),
      };

      return next;
    });
    this.scrollChatToBottom();
  }

  private scrollChatToBottom(): void {
    requestAnimationFrame(() => {
      const element = this.chatMessages?.nativeElement;
      if (!element) {
        return;
      }

      element.scrollTop = element.scrollHeight;
    });
  }

  private focusChatInput(): void {
    requestAnimationFrame(() => {
      const element = this.chatInputBox?.nativeElement;
      if (!element) {
        return;
      }

      element.focus();
    });
  }
}
