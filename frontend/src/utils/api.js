import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
