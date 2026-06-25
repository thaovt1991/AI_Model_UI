export interface PredictRequest {
  size: number;
  bedrooms: number;
}

export interface PredictResponse {
  predictedPrice: number;
  currency: string;
  message: string;
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
