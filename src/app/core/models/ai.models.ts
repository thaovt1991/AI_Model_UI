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

export type DashboardTab = 'predict' | 'chat';
