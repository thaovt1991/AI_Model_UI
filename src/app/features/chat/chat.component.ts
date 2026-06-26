import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../core/services/ai.service';
import { createId } from '../../core/utils/id.util';
import {
  ChatMessage,
  ChatTurn,
  DocumentInfo,
  LearningSettingsResponse,
  SettingsModalTab,
} from '../../core/models/ai.models';

const CHAT_CONVERSATION_KEY = 'ai_chat_conversation_id';
const CHAT_PROFILE_KEY = 'ai_chat_profile_id';
const LEARNING_NOTIFIED_VERSION_KEY = 'ai_learning_notified_version';
const LEARNING_NOTIFY_SETTINGS_KEY = 'ai_learning_notify_settings';
const DEFAULT_LEARNING_NOTIFY_INTERVAL_MIN = 2;

interface LearningNotifySettings {
  enabled: boolean;
  intervalMinutes: number;
}

function loadLearningNotifySettings(): LearningNotifySettings {
  try {
    const raw = localStorage.getItem(LEARNING_NOTIFY_SETTINGS_KEY);
    if (!raw) {
      return { enabled: false, intervalMinutes: DEFAULT_LEARNING_NOTIFY_INTERVAL_MIN };
    }

    const parsed = JSON.parse(raw) as Partial<LearningNotifySettings>;
    const minutes = Number(parsed.intervalMinutes);
    return {
      enabled: Boolean(parsed.enabled),
      intervalMinutes:
        Number.isFinite(minutes) && minutes >= 1
          ? Math.min(minutes, 120)
          : DEFAULT_LEARNING_NOTIFY_INTERVAL_MIN,
    };
  } catch {
    return { enabled: false, intervalMinutes: DEFAULT_LEARNING_NOTIFY_INTERVAL_MIN };
  }
}

const initialLearningNotifySettings = loadLearningNotifySettings();

const WELCOME_MESSAGE =
  'Xin chào! Tôi là trợ lý AI chạy trên máy của bạn. Hãy đặt câu hỏi, nhờ viết hoặc phân tích nội dung — bạn cũng có thể đính kèm tài liệu trong phần Thiết lập.';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements AfterViewInit, OnDestroy {
  private readonly aiService = inject(AiService);
  private learningPollTimer?: ReturnType<typeof setInterval>;
  private notifiedAdapterVersion = Number(
    localStorage.getItem(LEARNING_NOTIFIED_VERSION_KEY) ?? '0',
  );

  @ViewChild('chatMessages')
  private chatMessages?: ElementRef<HTMLDivElement>;

  @ViewChild('chatInputBox')
  private chatInputBox?: ElementRef<HTMLTextAreaElement>;

  @ViewChild('fileInput')
  private fileInput?: ElementRef<HTMLInputElement>;

  readonly chatInput = signal('');
  readonly chatLoading = signal(false);
  readonly chatError = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([
    {
      role: 'assistant',
      content: WELCOME_MESSAGE,
    },
  ]);

  readonly chatConversationId = signal(this.loadOrCreateConversationId());
  readonly chatProfileId = signal(this.loadOrCreateProfileId());
  readonly aiName = signal<string | null>(null);
  readonly aiNameDraft = signal('');
  readonly aiNameSaving = signal(false);
  readonly aiNameError = signal<string | null>(null);

  readonly chatTitle = computed(() => {
    const name = this.aiName();
    return name ? `Trợ lý ${name}` : 'Trợ lý AI';
  });

  readonly assistantLabel = computed(() => this.aiName() ?? 'Trợ lý AI');

  readonly documents = signal<DocumentInfo[]>([]);
  readonly selectedDocumentIds = signal<string[]>([]);
  readonly uploadLoading = signal(false);
  readonly documentError = signal<string | null>(null);

  readonly hasSelectedDocuments = computed(() => this.selectedDocumentIds().length > 0);
  readonly settingsModalOpen = signal(false);
  readonly settingsTab = signal<SettingsModalTab>('documents');

  readonly learningEnabled = signal(false);
  readonly learningCollectData = signal(true);
  readonly learningTotalSamples = signal(0);
  readonly learningStatus = signal<string>('Disabled');
  readonly learningSaving = signal(false);
  readonly learningError = signal<string | null>(null);
  readonly learningNotice = signal<string | null>(null);
  readonly learningTopics = signal<string[]>([]);
  readonly learningNotifyEnabled = signal(initialLearningNotifySettings.enabled);
  readonly learningNotifyIntervalMinutes = signal(initialLearningNotifySettings.intervalMinutes);

  readonly learningStatusLabel = computed(() => {
    const map: Record<string, string> = {
      Disabled: 'Tắt',
      Collecting: 'Đang gom dữ liệu',
      Idle: 'Sẵn sàng train',
      Queued: 'Chờ máy rảnh',
      Training: 'Đang học...',
      Ready: 'Đã học',
      Failed: 'Lỗi train',
    };
    return map[this.learningStatus()] ?? this.learningStatus();
  });

  ngAfterViewInit(): void {
    this.focusChatInput();
    this.loadDocuments();
    this.loadChatProfile();
    this.restoreChatHistory();
    this.loadLearningSettings();
    this.restartLearningPoll();
  }

  ngOnDestroy(): void {
    if (this.learningPollTimer) {
      clearInterval(this.learningPollTimer);
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

  openSettingsModal(tab: SettingsModalTab = 'documents'): void {
    this.documentError.set(null);
    this.learningError.set(null);
    this.aiNameError.set(null);
    this.settingsTab.set(tab);
    this.settingsModalOpen.set(true);
    this.loadDocuments();
    if (tab === 'ai') {
      this.loadChatProfile();
    }
    if (tab === 'learning' || tab === 'memory') {
      this.loadLearningSettings();
    }
  }

  closeSettingsModal(): void {
    this.settingsModalOpen.set(false);
  }

  loadLearningSettings(): void {
    this.aiService.getLearningSettings().subscribe({
      next: (res) => this.applyLearningSettings(res),
      error: () => {
        this.learningError.set('Không tải được cài đặt học model.');
      },
    });
  }

  loadChatProfile(): void {
    this.aiService.getChatProfile(this.chatProfileId()).subscribe({
      next: (res) => {
        const name = res.aiName?.trim() || null;
        this.aiName.set(name);
        this.aiNameDraft.set(name ?? '');
      },
      error: () => {
        this.aiNameError.set('Không tải được tên AI.');
      },
    });
  }

  saveAiName(): void {
    const draft = this.aiNameDraft().trim();
    this.aiNameSaving.set(true);
    this.aiNameError.set(null);

    this.aiService.updateChatProfile(this.chatProfileId(), { aiName: draft || null }).subscribe({
      next: (res) => {
        const name = res.aiName?.trim() || null;
        this.aiName.set(name);
        this.aiNameDraft.set(name ?? '');
        this.aiNameSaving.set(false);
      },
      error: () => {
        this.aiNameError.set('Không lưu được tên AI.');
        this.aiNameSaving.set(false);
      },
    });
  }

  clearAiName(): void {
    this.aiNameDraft.set('');
    this.saveAiName();
  }

  onToggleLearningEnabled(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.saveLearningSettings({ enabled: checked });
  }

  onToggleCollectData(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.saveLearningSettings({ collectData: checked });
  }

  onToggleLearningNotify(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.learningNotifyEnabled.set(checked);
    this.persistLearningNotifySettings();
    this.restartLearningPoll();
  }

  onLearningNotifyIntervalChange(value: number | string): void {
    const minutes = Math.min(
      120,
      Math.max(1, Number(value) || DEFAULT_LEARNING_NOTIFY_INTERVAL_MIN),
    );
    this.learningNotifyIntervalMinutes.set(minutes);
    this.persistLearningNotifySettings();
    this.restartLearningPoll();
  }

  dismissLearningNotice(): void {
    this.learningNotice.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.settingsModalOpen()) {
      this.closeSettingsModal();
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

  async onSendChat(): Promise<void> {
    const text = this.chatInput().trim();
    if (!text || this.chatLoading()) {
      return;
    }

    const docIds = this.selectedDocumentIds();
    const conversationId = this.chatConversationId();
    const profileId = this.chatProfileId();

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
          conversationId,
          profileId,
        },
        (token) => {
          this.appendToLastAssistantMessage(token);
        },
      );

      this.markMockReplyIfNeeded();
    } catch {
      this.chatError.set('Không mở được stream chat. Kiểm tra Backend và cấu hình CORS.');
      this.replaceLastAssistantMessage('Không thể nhận phản hồi từ Backend. Vui lòng thử lại.');
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

  startNewChatFromSettings(): void {
    this.closeSettingsModal();
    this.startNewChat();
  }

  startNewChat(): void {
    const confirmed = confirm(
      'Bắt đầu cuộc chat mới?\n\nMàn hình sẽ trống. F5 sau đó không còn hiện lại cuộc chat cũ.',
    );
    if (!confirmed) {
      return;
    }

    this.resetChatUi();
  }

  clearPermanentMemory(): void {
    const confirmed = confirm(
      'Xóa toàn bộ trí nhớ hội thoại trên server?\n\nHành động này không thể hoàn tác. AI sẽ không còn nhớ các lượt chat trước.',
    );
    if (!confirmed) {
      return;
    }

    const profileId = this.chatProfileId();
    this.aiService.clearChatMemory(profileId).subscribe({
      next: () => {
        this.resetChatUi();
        this.closeSettingsModal();
      },
      error: () => {
        this.chatError.set('Không xóa được trí nhớ trên server.');
      },
    });
  }

  private persistLearningNotifySettings(): void {
    const payload: LearningNotifySettings = {
      enabled: this.learningNotifyEnabled(),
      intervalMinutes: this.learningNotifyIntervalMinutes(),
    };
    localStorage.setItem(LEARNING_NOTIFY_SETTINGS_KEY, JSON.stringify(payload));
  }

  private saveLearningSettings(patch: { enabled?: boolean; collectData?: boolean }): void {
    this.learningSaving.set(true);
    this.learningError.set(null);

    this.aiService.updateLearningSettings(patch).subscribe({
      next: (res) => {
        this.applyLearningSettings(res);
        this.learningSaving.set(false);
      },
      error: () => {
        this.learningError.set('Không lưu được cài đặt.');
        this.learningSaving.set(false);
        this.loadLearningSettings();
      },
    });
  }

  private applyLearningSettings(res: LearningSettingsResponse): void {
    this.learningEnabled.set(res.enabled);
    this.learningCollectData.set(res.collectData);
    this.learningTotalSamples.set(res.totalSamples);
    this.learningStatus.set(res.status);
    this.learningTopics.set(res.learnedTopics ?? []);
    this.checkLearningNotification(res);
  }

  private restartLearningPoll(): void {
    if (this.learningPollTimer) {
      clearInterval(this.learningPollTimer);
      this.learningPollTimer = undefined;
    }

    if (!this.learningNotifyEnabled()) {
      return;
    }

    const intervalMs = this.learningNotifyIntervalMinutes() * 60_000;
    this.learningPollTimer = setInterval(() => {
      if (!this.learningEnabled()) {
        return;
      }

      this.aiService.getLearningSettings().subscribe({
        next: (res) => this.applyLearningSettings(res),
      });
    }, intervalMs);
  }

  private checkLearningNotification(res: LearningSettingsResponse): void {
    if (!this.learningNotifyEnabled()) {
      return;
    }

    if (
      !res.enabled ||
      res.adapterVersion <= 0 ||
      !res.lastTrainingMessage ||
      res.status !== 'Ready'
    ) {
      return;
    }

    if (res.adapterVersion <= this.notifiedAdapterVersion) {
      return;
    }

    this.notifiedAdapterVersion = res.adapterVersion;
    localStorage.setItem(LEARNING_NOTIFIED_VERSION_KEY, String(res.adapterVersion));

    const aiLabel = this.aiName() ?? 'Trợ lý AI';
    const notice = `${aiLabel} vừa hoàn tất học ngầm — ${res.lastTrainingMessage}.`;
    this.learningNotice.set(notice);
    this.pushLearningNoticeToChat(notice);
  }

  private pushLearningNoticeToChat(content: string): void {
    this.messages.update((list) => [
      ...list,
      {
        role: 'assistant',
        content,
      },
    ]);
    this.scrollChatToBottom();
  }

  private resetChatUi(): void {
    const newConversationId = createId();
    sessionStorage.setItem(CHAT_CONVERSATION_KEY, newConversationId);
    this.chatConversationId.set(newConversationId);
    this.messages.set([{ role: 'assistant', content: WELCOME_MESSAGE }]);
    this.chatError.set(null);
    this.focusChatInput();
  }

  private restoreChatHistory(): void {
    this.aiService.getChatMemory(this.chatProfileId(), this.chatConversationId()).subscribe({
      next: (turns) => {
        if (turns.length === 0) {
          return;
        }

        this.messages.set(this.buildMessagesFromHistory(turns));
        this.scrollChatToBottom();
      },
      error: () => {
        // Server cũ chưa có API — bỏ qua
      },
    });
  }

  private buildMessagesFromHistory(turns: ChatTurn[]): ChatMessage[] {
    const messages: ChatMessage[] = [{ role: 'assistant', content: WELCOME_MESSAGE }];

    for (const turn of turns) {
      messages.push({ role: 'user', content: turn.userMessage });
      messages.push({
        role: 'assistant',
        content: turn.assistantReply,
        isMock: turn.assistantReply.startsWith('[Chế độ mock'),
      });
    }

    return messages;
  }

  private loadOrCreateConversationId(): string {
    const existing = sessionStorage.getItem(CHAT_CONVERSATION_KEY);
    if (existing) {
      return existing;
    }

    const id = createId();
    sessionStorage.setItem(CHAT_CONVERSATION_KEY, id);
    return id;
  }

  private loadOrCreateProfileId(): string {
    const existing = localStorage.getItem(CHAT_PROFILE_KEY);
    if (existing) {
      return existing;
    }

    const id = createId();
    localStorage.setItem(CHAT_PROFILE_KEY, id);
    return id;
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
