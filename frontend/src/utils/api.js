import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
});

// Request interceptor - add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle token expiration with auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Auto-report failures (≥500, network failures, 502/504 timeouts) to the
    // Admin Issues log. Silent — never throws. Skips reporting auth-refresh
    // and the report endpoint itself to avoid loops.
    try {
      const status = error.response?.status;
      const url = (originalRequest?.url || '');
      const isReportEndpoint = url.includes('/admin/log-frontend-error');
      const isAuthRefresh = url.includes('/auth/login') && originalRequest?._retry;
      const shouldReport =
        !isReportEndpoint &&
        !isAuthRefresh &&
        (
          !error.response ||                  // network/CORS failure
          status === 502 || status === 503 || status === 504 ||
          (status >= 500 && status < 600)     // any 5xx
        );
      if (shouldReport) {
        const fullUrl = `${originalRequest?.method?.toUpperCase() || 'GET'} ${url}`;
        const detail = error.response?.data?.detail
          || error.message
          || 'Request failed';
        // fire-and-forget; don't await — must not block the rejection chain
        axios.post(`${API}/admin/log-frontend-error`, {
          error_type: status ? `HTTP_${status}` : 'NETWORK_FAILURE',
          message: typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 500),
          url: fullUrl,
          component: 'axios',
          status_code: status || null,
          stack: (error.stack || '').slice(0, 4000),
        }, {
          headers: localStorage.getItem('token')
            ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
            : {},
          timeout: 8000,
        }).catch(() => { /* ignore — don't recurse */ });
      }
    } catch (_) { /* never throw from the interceptor */ }

    // If token expired (401) and we haven't retried yet
    if (error.response?.status === 401 && 
        (error.response?.data?.detail === 'Token expired' || error.response?.data?.detail === 'Invalid token') &&
        !originalRequest._retry) {
      
      originalRequest._retry = true;
      
      // Try to re-authenticate using stored credentials
      const storedOfficerId = localStorage.getItem('officer_id');
      const storedPassword = localStorage.getItem('officer_password');
      
      if (storedOfficerId && storedPassword) {
        try {
          // Silent re-authentication
          const refreshResponse = await axios.post(`${API}/auth/login`, {
            officer_id: storedOfficerId,
            password: storedPassword
          });
          
          const newToken = refreshResponse.data.token;
          localStorage.setItem('token', newToken);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // If refresh fails, clear storage and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('officer_id');
          localStorage.removeItem('officer_password');
          window.location.href = '/';
          return Promise.reject(refreshError);
        }
      } else {
        // No stored credentials, redirect to login
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }
    
    return Promise.reject(error);
  }
);

export const auth = {
  login: async (officer_id, password) => {
    const response = await api.post('/auth/login', { officer_id, password });
    return response.data;
  },
  signup: async (data) => {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },
  forgotPassword: async ({ officer_id, email, reason }) => {
    const response = await api.post('/auth/forgot-password', { officer_id, email, reason });
    return response.data;
  },
  changePassword: async ({ current_password, new_password }) => {
    const response = await api.post('/auth/change-password', { current_password, new_password });
    return response.data;
  },
};

export const ocr = {
  processImage: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/ocr/process', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export const speech = {
  processAudio: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/speech/process', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export const fir = {
  create: async (complaint_text) => {
    const formData = new FormData();
    formData.append('complaint_text', complaint_text);
    const response = await api.post('/fir/create', formData);
    return response.data;
  },
  list: async () => {
    const response = await api.get('/fir/list');
    return response.data;
  },
  get: async (fir_id) => {
    const response = await api.get(`/fir/${fir_id}`);
    return response.data;
  },
};

export const bns = {
  analyze: async (text) => {
    const response = await api.post('/bns/analyze', { text });
    return response.data;
  },
  search: async (section_number) => {
    const formData = new FormData();
    formData.append('section_number', section_number);
    const response = await api.post('/bns/search', formData);
    return response.data;
  },
};

export const reminders = {
  create: async (data) => {
    const response = await api.post('/reminders/create', data);
    return response.data;
  },
  list: async () => {
    const response = await api.get('/reminders/list');
    return response.data;
  },
};

export const subscription = {
  update: async (plan) => {
    const formData = new FormData();
    formData.append('plan', plan);
    const response = await api.post('/subscription/update', formData);
    return response.data;
  },
};

// Default export for convenience
export default api;
