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
}

export interface ChatResponse {
  reply: string;
  isMock: boolean;
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
