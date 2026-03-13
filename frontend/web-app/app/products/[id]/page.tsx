'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { productsAPI, cartAPI } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    productsAPI.get(id as string)
      .then(res => setProduct(res.data.product))
      .catch(() => router.push('/products'))
      .finally(() => setLoading(false));
  }, [id]);

  const addToCart = async () => {
    if (!user) { router.push('/login'); return; }
    setAdding(true);
    try {
      await cartAPI.add({
        product_id: product.id,
        product_name: product.name,
        price: parseFloat(product.price),
        quantity,
        image_url: product.image_url,
      });
      router.push('/cart');
    } catch (err) {
      alert('Failed to add to cart');
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500">Loading...</div>;
  if (!product) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="md:flex">
          <div className="md:w-1/2">
            <img
              src={product.image_url || `https://picsum.photos/seed/${product.id}/600/500`}
              alt={product.name}
              className="w-full h-80 md:h-full object-cover"
            />
          </div>
          <div className="md:w-1/2 p-8">
            {product.category_name && (
              <span className="text-sm text-blue-600 font-medium uppercase tracking-wide">
                {product.category_name}
              </span>
            )}
            <h1 className="text-3xl font-bold text-gray-900 mt-2">{product.name}</h1>
            <p className="text-gray-600 mt-4 leading-relaxed">{product.description}</p>
            <div className="mt-6">
              <span className="text-4xl font-bold text-gray-900">${product.price}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <span className={product.stock > 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              </span>
            </div>
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-l-lg transition"
                >−</button>
                <span className="px-4 py-2 font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-r-lg transition"
                >+</button>
              </div>
              <button
                onClick={addToCart}
                disabled={adding || product.stock === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 rounded-lg transition"
              >
                {adding ? 'Adding...' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
