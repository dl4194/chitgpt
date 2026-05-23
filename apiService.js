const API_BASE_URL = 'https://dl4194.duckdns.org/api';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

async function parseErrorResponse(response) {
  try {
    const data = await response.json();
    return data.error || data.message || 'Unknown error';
  } catch {
    return `HTTP ${response.status}: ${response.statusText}`;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const timeout = options.timeout || 30000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response);
      throw new ApiError(errorMessage, response.status, { endpoint, method: options.method });
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error.name === 'AbortError') {
      throw new ApiError('Request timeout - please try again', 408, { endpoint });
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Network error - unable to reach server', 0, { endpoint });
    }

    throw new ApiError(error.message, 0, { endpoint });
  }
}

async function streamRequest(endpoint, options = {}, onChunk) {
  const url = `${API_BASE_URL}${endpoint}`;
  const signal = options.signal;
  let reader = null;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response);
      throw new ApiError(errorMessage, response.status, { endpoint });
    }

    if (!response.body) {
      throw new ApiError('Response body is empty', 0, { endpoint });
    }

    reader = response.body.getReader();

    if (signal) {
      signal.addEventListener('abort', () => {
        reader.cancel();
      });
    }

    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);

        if (data === '[DONE]') {
          onChunk({ done: true, fullResponse });
          return fullResponse;
        }

        try {
          const parsed = JSON.parse(data);

          if (parsed.error) {
            throw new ApiError(parsed.error, 500, { endpoint, streaming: true });
          }

          if (parsed.token) {
            fullResponse += parsed.token;
            onChunk({ token: parsed.token });
          }

          if (parsed.stopped) {
            onChunk({ stopped: true, fullResponse });
            return fullResponse;
          }
        } catch (e) {
          if (!data) continue;
          if (e instanceof ApiError) throw e;
        }
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error.name === 'AbortError') {
      throw new ApiError('Request was cancelled', 0, { endpoint });
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Network error - connection failed', 0, { endpoint });
    }

    throw new ApiError(error.message, 0, { endpoint });
  } finally {
    if (reader) {
      reader.cancel().catch(() => {});
    }
  }
}

export const apiService = {
  async createSession(token, name) {
    return request('/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
  },

  async loadSessions(token) {
    return request('/sessions', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async loadChatHistory(token, sessionId) {
    return request(`/session/${sessionId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async deleteSession(token, sessionId) {
    return request(`/session/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async streamChat(token, sessionId, message, onChunk, signal) {
    return streamRequest(
      `/chat/${sessionId}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message }),
        signal,
      },
      onChunk
    );
  },

  ApiError,
};
