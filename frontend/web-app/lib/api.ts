import axios from 'axios';

// When running in browser: use empty string = relative URLs (same host)
// This works whether frontend is on :3000 or :80
const API_BASE = typeof window !== 'undefined' ? '' : 'http://nginx:80';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auth
export const authAPI = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/api/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/api/auth/login', data),
  profile: () => api.get('/api/auth/profile'),
};

// Products
export const productsAPI = {
  list: (params?: { search?: string; category?: string; page?: number; limit?: number }) =>
    api.get('/api/products', { params }),
  get: (id: string) => api.get(`/api/products/${id}`),
  categories: () => api.get('/api/categories'),
};

// Cart
export const cartAPI = {
  get: () => api.get('/api/cart'),
  add: (item: { product_id: string; product_name: string; price: number; quantity: number; image_url?: string }) =>
    api.post('/api/cart', item),
  update: (productId: string, quantity: number) =>
    api.put(`/api/cart/${productId}`, { quantity }),
  remove: (productId: string) => api.delete(`/api/cart/${productId}`),
  clear: () => api.delete('/api/cart'),
};

// Orders
export const ordersAPI = {
  list: () => api.get('/api/orders'),
  get: (id: string) => api.get(`/api/orders/${id}`),
  checkout: (data: { shipping_address: string; payment_method: string }) =>
    api.post('/api/orders/checkout', data),
};

export default api;
