
import { ChatMessage } from '@/types/api';

const SESSION_STORAGE_KEY = 'fairental_session_id';
const CHAT_HISTORY_KEY = 'fairental_chat_history';

export const sessionStorage = {
  getSessionId: (): string | null => {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  },

  setSessionId: (sessionId: string): void => {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  },

  getChatHistory: (): ChatMessage[] => {
    const history = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!history) return [];
    
    try {
      return JSON.parse(history).map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
    } catch {
      return [];
    }
  },

  saveChatHistory: (messages: ChatMessage[]): void => {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
  },

  clearChatHistory: (): void => {
    localStorage.removeItem(CHAT_HISTORY_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  },
};
