'use client';
import { useEffect, useState } from 'react';
import { cartAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CartPage() {
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchCart = async () => {
    try {
      const res = await cartAPI.get();
      setCart(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCart(); }, []);

  const updateQuantity = async (productId: string, quantity: number) => {
    try {
      await cartAPI.update(productId, quantity);
      fetchCart();
    } catch (err) { console.error(err); }
  };

  const removeItem = async (productId: string) => {
    try {
      await cartAPI.remove(productId);
      fetchCart();
    } catch (err) { console.error(err); }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Shopping Cart</h1>
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading cart...</div>
        ) : !cart || cart.items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-4">Your cart is empty</p>
            <Link href="/products" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
              Browse Products
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {cart.items.map((item: any) => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4">
                  <img
                    src={item.image_url || `https://picsum.photos/seed/${item.product_id}/80/80`}
                    alt={item.product_name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{item.product_name}</h3>
                    <p className="text-gray-500 text-sm">${item.price} each</p>
                  </div>
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-l-lg disabled:opacity-30 transition"
                    >−</button>
                    <span className="px-3 py-1 font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-r-lg transition"
                    >+</button>
                  </div>
                  <p className="font-bold text-gray-900 w-20 text-right">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                  <button
                    onClick={() => removeItem(item.product_id)}
                    className="text-red-400 hover:text-red-600 transition text-sm"
                  >Remove</button>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600">Total ({cart.item_count} items)</span>
                <span className="text-2xl font-bold text-gray-900">${cart.total}</span>
              </div>
              <button
                onClick={() => router.push('/checkout')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition"
              >
                Proceed to Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
