export const SERVER_BASE_URL = (() => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' ||
      !window.location.hostname ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1')
  ) {
    return 'http://localhost:3001';
  }
  return window.location.origin;
})();

export const API_BASE = `${SERVER_BASE_URL}/api`;

export const getAuthToken = () => localStorage.getItem('concord_token');
export const setAuthToken = (token) => localStorage.setItem('concord_token', token);
export const removeAuthToken = () => localStorage.removeItem('concord_token');

export const getFullMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  return `${SERVER_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

export const apiFetch = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Erro na requisição');
  }

  return data;
};

export const uploadFile = async (file) => {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: formData
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erro no upload de arquivo');
  }

  return data;
};
