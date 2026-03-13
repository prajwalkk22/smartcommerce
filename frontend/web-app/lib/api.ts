import axios from 'axios';

const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/api/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/api/auth/login', data),
  profile: () => api.get('/api/auth/profile'),
};

export const productsAPI = {
  list: (params?: { search?: string; category?: string; page?: number; limit?: number }) =>
    api.get('/api/products', { params }),
  get: (id: string) => api.get(`/api/products/${id}`),
  categories: () => api.get('/api/categories'),
};

export const cartAPI = {
  get: () => api.get('/api/cart'),
  add: (item: { product_id: string; product_name: string; price: number; quantity: number; image_url?: string }) =>
    api.post('/api/cart', item),
  update: (productId: string, quantity: number) =>
    api.put(`/api/cart/${productId}`, { quantity }),
  remove: (productId: string) => api.delete(`/api/cart/${productId}`),
  clear: () => api.delete('/api/cart'),
};

export const ordersAPI = {
  list: () => api.get('/api/orders'),
  get: (id: string) => api.get(`/api/orders/${id}`),
  checkout: (data: { shipping_address: string; payment_method: string }) =>
    api.post('/api/orders/checkout', data),
};

export const recommendationsAPI = {
  forYou: (limit = 8) =>
    api.get('/api/recommendations/for-you', { params: { limit } }),
  similar: (productId: string, limit = 6) =>
    api.get(`/api/recommendations/similar/${productId}`, { params: { limit } }),
  popular: (limit = 8) =>
    api.get('/api/recommendations/popular', { params: { limit } }),
  track: (product_id: string, action: 'view' | 'cart_add' | 'purchase') =>
    api.post('/api/recommendations/track', { product_id, action }),
};

export default api;
