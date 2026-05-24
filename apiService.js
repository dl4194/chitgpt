const API_BASE_URL = 'https://dl4194.duckdns.org/api';

class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function createHeaders(options = {}) {
  return {
    ...(options.body && {
      'Content-Type': 'application/json',
    }),
    ...options.headers,
  };
}

async function parseResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

async function parseErrorResponse(response) {
  try {
    const data = await parseResponse(response);

    if (typeof data === 'string') {
      return data;
    }

    return (
      data?.error ||
      data?.message ||
      `HTTP ${response.status}: ${response.statusText}`
    );
  } catch {
    return `HTTP ${response.status}: ${response.statusText}`;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const timeout = options.timeout ?? 30000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: createHeaders(options),
    });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response);

      throw new ApiError(errorMessage, response.status, {
        endpoint,
        method: options.method,
      });
    }

    return await parseResponse(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      throw new ApiError(
        'Request timeout - please try again',
        408,
        { endpoint }
      );
    }

    if (error instanceof TypeError) {
      throw new ApiError(
        'Network error - unable to reach server',
        0,
        { endpoint }
      );
    }

    throw new ApiError(
      error?.message || 'Unknown error',
      0,
      { endpoint }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function streamRequest(endpoint, options = {}, onChunk) {
  const url = `${API_BASE_URL}${endpoint}`;

  let reader = null;
  let abortHandler = null;

  try {
    const response = await fetch(url, {
      ...options,
      headers: createHeaders(options),
    });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response);

      throw new ApiError(errorMessage, response.status, {
        endpoint,
      });
    }

    if (!response.body) {
      throw new ApiError(
        'Response body is empty',
        0,
        { endpoint }
      );
    }

    reader = response.body.getReader();

    if (options.signal) {
      abortHandler = async () => {
        try {
          await reader.cancel();
        } catch {}
      };

      options.signal.addEventListener('abort', abortHandler);
    }

    const decoder = new TextDecoder();

    let buffer = '';
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split('\n');

      // Keep incomplete chunk in buffer
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line.startsWith('data: ')) {
          continue;
        }

        const data = line.slice(6);

        if (!data) {
          continue;
        }

        if (data === '[DONE]') {
          onChunk?.({
            done: true,
            fullResponse,
          });

          return fullResponse;
        }

        try {
          const parsed = JSON.parse(data);

          if (parsed.error) {
            throw new ApiError(
              parsed.error,
              500,
              {
                endpoint,
                streaming: true,
              }
            );
          }

          if (parsed.token) {
            fullResponse += parsed.token;

            onChunk?.({
              token: parsed.token,
              fullResponse,
            });
          }

          if (parsed.stopped) {
            onChunk?.({
              stopped: true,
              fullResponse,
            });

            return fullResponse;
          }
        } catch (error) {
          if (error instanceof ApiError) {
            throw error;
          }

          // Ignore malformed/incomplete JSON chunks
        }
      }
    }

    return fullResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      throw new ApiError(
        'Request was cancelled',
        0,
        { endpoint }
      );
    }

    if (error instanceof TypeError) {
      throw new ApiError(
        'Network error - connection failed',
        0,
        { endpoint }
      );
    }

    throw new ApiError(
      error?.message || 'Unknown streaming error',
      0,
      { endpoint }
    );
  } finally {
    if (options.signal && abortHandler) {
      options.signal.removeEventListener(
        'abort',
        abortHandler
      );
    }

    if (reader) {
      try {
        await reader.cancel();
      } catch {}
    }
  }
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export const apiService = {
  ApiError,

  async createSession(token, name) {
    return request('/session', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name }),
    });
  },

  async loadSessions(token) {
    return request('/sessions', {
      method: 'GET',
      headers: authHeaders(token),
    });
  },

  async loadChatHistory(token, sessionId) {
    return request(`/session/${sessionId}`, {
      method: 'GET',
      headers: authHeaders(token),
    });
  },

  async deleteSession(token, sessionId) {
    return request(`/session/${sessionId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  },

  async streamChat(
    token,
    sessionId,
    message,
    onChunk,
    signal
  ) {
    return streamRequest(
      `/chat/${sessionId}`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ message }),
        signal,
      },
      onChunk
    );
  },
};