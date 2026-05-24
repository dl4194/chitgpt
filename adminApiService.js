const API_BASE_URL = 'https://dl4194.duckdns.org/admin';

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

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export const apiService = {
  ApiError,

  async getUsers(token) {
    return request('/users', {
      method: 'GET',
      headers: authHeaders(token)
    });
  },

  async loadSessions(token, uid) {
    return request(`/sessions/${uid}`, {
      method: 'GET',
      headers: authHeaders(token)
    });
  },

  async loadChatHistory(token, sessionId, uid) {
    return request(`/session/${uid}/${sessionId}`, {
      method: 'GET',
      headers: authHeaders(token)
    });
  },

  async makeAdmin(token, uid) {
    return request(`/setadmin/${uid}`, {
      method: 'POST',
      headers: authHeaders(token)
    });
  },
};