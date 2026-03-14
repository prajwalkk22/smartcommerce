import axios from 'axios';

const USER_SERVICE    = process.env.NEXT_PUBLIC_USER_SERVICE_URL    || 'https://user-service-w1v3.onrender.com';
const PRODUCT_SERVICE = process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL || 'https://product-service-be0f.onrender.com';
const ORDER_SERVICE   = process.env.NEXT_PUBLIC_ORDER_SERVICE_URL   || 'https://order-service-ed7k.onrender.com';
const REC_SERVICE     = process.env.NEXT_PUBLIC_REC_SERVICE_URL     || 'https://recommendation-service-3ypl.onrender.com';

function authHeader() {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const authAPI = {
  register: (data: any) => axios.post(`${USER_SERVICE}/api/auth/register`, data),
  login:    (data: any) => axios.post(`${USER_SERVICE}/api/auth/login`, data),
  profile:  ()         => axios.get(`${USER_SERVICE}/api/auth/profile`, { headers: authHeader() }),
};

export const productsAPI = {
  list:       (params?: any) => axios.get(`${PRODUCT_SERVICE}/api/products`, { params }),
  get:        (id: string)   => axios.get(`${PRODUCT_SERVICE}/api/products/${id}`),
  categories: ()             => axios.get(`${PRODUCT_SERVICE}/api/categories`),
};

export const searchAPI = {
  search:      (params: any) => axios.get(`${PRODUCT_SERVICE}/api/search`, { params }),
  suggestions: (q: string)   => axios.get(`${PRODUCT_SERVICE}/api/search/suggestions`, { params: { q } }),
  trending:    ()            => axios.get(`${PRODUCT_SERVICE}/api/search/trending`),
};

export const cartAPI = {
  get:    ()                        => axios.get(`${ORDER_SERVICE}/api/cart`, { headers: authHeader() }),
  add:    (item: any)               => axios.post(`${ORDER_SERVICE}/api/cart`, item, { headers: authHeader() }),
  update: (id: string, qty: number) => axios.put(`${ORDER_SERVICE}/api/cart/${id}`, { quantity: qty }, { headers: authHeader() }),
  remove: (id: string)              => axios.delete(`${ORDER_SERVICE}/api/cart/${id}`, { headers: authHeader() }),
  clear:  ()                        => axios.delete(`${ORDER_SERVICE}/api/cart`, { headers: authHeader() }),
};

export const ordersAPI = {
  list:     ()           => axios.get(`${ORDER_SERVICE}/api/orders`, { headers: authHeader() }),
  get:      (id: string) => axios.get(`${ORDER_SERVICE}/api/orders/${id}`, { headers: authHeader() }),
  checkout: (data: any)  => axios.post(`${ORDER_SERVICE}/api/orders/checkout`, data, { headers: authHeader() }),
};

export const recommendationsAPI = {
  forYou:  (limit = 8)                    => axios.get(`${REC_SERVICE}/api/recommendations/for-you`, { params: { limit }, headers: authHeader() }),
  similar: (productId: string, limit = 6) => axios.get(`${REC_SERVICE}/api/recommendations/similar/${productId}`, { params: { limit } }),
  popular: (limit = 8)                    => axios.get(`${REC_SERVICE}/api/recommendations/popular`, { params: { limit } }),
  track:   (product_id: string, action: string) => axios.post(`${REC_SERVICE}/api/recommendations/track`, { product_id, action }, { headers: authHeader() }),
};

export default axios;
