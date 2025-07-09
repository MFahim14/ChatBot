// Use the provided API Gateway URL
const BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || 'https://ozx8sl9pz7.execute-api.us-east-1.amazonaws.com/prod/fairrental';

export const chatApi = {
  sendMessage: async (userQuestion: string, sessionId?: string) => {
    try {
      const response = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userQuestion,
          ...(sessionId && { sessionId }),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ 
          message: `HTTP ${response.status}: ${response.statusText}` 
        }));
        throw new Error(error.message || 'Failed to send message');
      }

      return response.json();
    } catch (error) {
      console.error('Chat API Error:', error);
      throw error;
    }
  },

  submitCorrection: async (correction: any) => {
    try {
      const response = await fetch(`${BASE_URL}/admin/correct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(correction),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ 
          message: `HTTP ${response.status}: ${response.statusText}` 
        }));
        throw new Error(error.message || 'Failed to submit correction');
      }

      return response.json();
    } catch (error) {
      console.error('Correction API Error:', error);
      throw error;
    }
  },

  getAdminHistory: async (filters?: { sessionId?: string; limit?: number }) => {
    try {
      const params = new URLSearchParams();
      if (filters?.sessionId) {
        params.append('sessionId', filters.sessionId);
      }
      if (filters?.limit) {
        params.append('limit', filters.limit.toString());
      }

      const url = `${BASE_URL}/admin/history${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ 
          message: `HTTP ${response.status}: ${response.statusText}` 
        }));
        throw new Error(error.message || 'Failed to fetch admin history');
      }

      return response.json();
    } catch (error) {
      console.error('Admin History API Error:', error);
      throw error;
    }
  },
};
