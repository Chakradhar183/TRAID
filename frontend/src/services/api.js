import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 (expired token)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      error.config?.url !== '/auth/login' &&
      error.config?.url !== '/auth/register'
    ) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);


// ---- Auth ----
export const login = (username, password) =>
  api.post('/auth/login', { username, password });

export const register = (username, password, email, division) =>
  api.post('/auth/register', { username, password, email, division });

// ---- Documents ----
export const getDocuments = (params) => api.get('/documents/', { params });

export const getDocument = (docId) => api.get(`/documents/${docId}`);

export const uploadDocument = (formData) =>
  api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const downloadDocument = (docId) =>
  api.get(`/documents/${docId}/download`, { responseType: 'blob' });

// ---- Access ----
export const requestAccess = (docId) =>
  api.post('/access/request', { doc_id: docId });

export const approveAccess = (requestId) =>
  api.post('/access/approve', { request_id: requestId });

export const rejectAccess = (requestId) =>
  api.post('/access/reject', { request_id: requestId });

export const getPendingRequests = () => api.get('/access/pending');

export const getMyRequests = () => api.get('/access/my-requests');

// ---- Search ----
export const searchDocuments = (query) =>
  api.get('/search', { params: { q: query } });

// ---- Metadata ----
export const getMetadataFields = () => api.get('/metadata/fields');

export const createMetadataField = (data) =>
  api.post('/metadata/fields', data);

export const updateMetadataField = (fieldId, data) =>
  api.put(`/metadata/fields/${fieldId}`, data);

export const deleteMetadataField = (fieldId) =>
  api.delete(`/metadata/fields/${fieldId}`);

export default api;
