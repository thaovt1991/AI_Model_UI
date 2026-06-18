import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../core/services/ai.service';
import { ChatMessage, DashboardTab, DocumentInfo } from '../../core/models/ai.models';

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

  @ViewChild('fileInput')
  private fileInput?: ElementRef<HTMLInputElement>;

  readonly activeTab = signal<DashboardTab>('chat');

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

  readonly chatInput = signal('');
  readonly chatLoading = signal(false);
  readonly chatError = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Xin chào! Bấm biểu tượng cài đặt góc phải để upload và chọn tài liệu nội bộ — AI sẽ dùng làm ngữ cảnh trả lời.',
    },
  ]);

  // --- Tài liệu nội bộ (RAG) ---
  readonly documents = signal<DocumentInfo[]>([]);
  readonly selectedDocumentIds = signal<string[]>([]);
  readonly uploadLoading = signal(false);
  readonly documentError = signal<string | null>(null);

  readonly hasSelectedDocuments = computed(() => this.selectedDocumentIds().length > 0);
  readonly docsModalOpen = signal(false);

  ngAfterViewInit(): void {
    this.focusChatInput();
    this.loadDocuments();
  }

  setTab(tab: DashboardTab): void {
    this.activeTab.set(tab);
    if (tab === 'chat') {
      this.focusChatInput();
      this.loadDocuments();
    }
  }

  loadDocuments(): void {
    this.aiService.listDocuments().subscribe({
      next: (docs) => {
        this.documents.set(docs);
        const validIds = new Set(docs.map((d) => d.id));
        this.selectedDocumentIds.update((ids) => ids.filter((id) => validIds.has(id)));
      },
      error: () => {
        this.documentError.set('Không tải được danh sách tài liệu.');
      },
    });
  }

  openDocsModal(): void {
    this.documentError.set(null);
    this.docsModalOpen.set(true);
    this.loadDocuments();
  }

  closeDocsModal(): void {
    this.docsModalOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.docsModalOpen()) {
      this.closeDocsModal();
    }
  }

  openFilePicker(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.uploadLoading.set(true);
    this.documentError.set(null);

    this.aiService.uploadDocument(file).subscribe({
      next: (res) => {
        this.uploadLoading.set(false);
        input.value = '';
        this.loadDocuments();
        this.selectedDocumentIds.update((ids) =>
          ids.includes(res.id) ? ids : [...ids, res.id],
        );
      },
      error: (err) => {
        this.uploadLoading.set(false);
        input.value = '';
        this.documentError.set(
          err.error?.message ?? 'Upload thất bại. Kiểm tra định dạng file.',
        );
      },
    });
  }

  toggleDocument(id: string): void {
    this.selectedDocumentIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  isDocumentSelected(id: string): boolean {
    return this.selectedDocumentIds().includes(id);
  }

  removeDocument(id: string, event: Event): void {
    event.stopPropagation();
    this.aiService.deleteDocument(id).subscribe({
      next: () => {
        this.selectedDocumentIds.update((ids) => ids.filter((x) => x !== id));
        this.loadDocuments();
      },
      error: () => {
        this.documentError.set('Không xóa được tài liệu.');
      },
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

    const docIds = this.selectedDocumentIds();

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

    try {
      await this.aiService.streamChat(
        {
          message: text,
          documentIds: docIds.length > 0 ? docIds : undefined,
        },
        (token) => {
          this.appendToLastAssistantMessage(token);
        },
      );

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
