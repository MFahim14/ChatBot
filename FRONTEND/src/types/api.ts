export interface ChatRequest {
  userQuestion: string;
  sessionId?: string;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  interactionId: string;
}

export interface AdminCorrectionRequest {
  sessionId: string;
  interactionId: string;
  userQuestion: string;
  originalAIResponse: string;
  correctedAIResponse: string;
  adminId?: string;
  correctionTimestamp?: string;
}

export interface AdminCorrectionResponse {
  message: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  sessionId?: string;
  interactionId?: string;
}

export interface ChatHistory {
  sessionId: string;
  interactionId: string;
  userQuestion: string;
  aiResponse: string;
  timestamp: Date;
}

// New types for admin history API
export interface HistoryItem {
  SessionId: string;
  InteractionId: string;
  Timestamp: string;
  EventType: 'QUESTION' | 'AI_RESPONSE' | 'ADMIN_CORRECTION';
  Timestamp_EventType: string;
  Content: string;
  UserQuestion?: string;
}

export interface AdminHistoryResponse {
  history: HistoryItem[];
}

export interface AdminHistoryFilters {
  sessionId?: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
}
