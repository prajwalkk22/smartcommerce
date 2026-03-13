'use client';
import Link from 'next/link';
import { cartAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  image_url: string;
  category_name: string;
  stock: number;
}

export default function ProductCard({ product }: { product: Product }) {
  const { user } = useAuth();
  const router = useRouter();

  const addToCart = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      await cartAPI.add({
        product_id: product.id,
        product_name: product.name,
        price: parseFloat(product.price),
        quantity: 1,
        image_url: product.image_url,
      });
      alert('Added to cart!');
    } catch (err) {
      alert('Failed to add to cart');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow">
      <Link href={`/products/${product.id}`}>
        <img
          src={product.image_url || `https://picsum.photos/seed/${product.id}/400/300`}
          alt={product.name}
          className="w-full h-48 object-cover"
        />
      </Link>
      <div className="p-4">
        {product.category_name && (
          <span className="text-xs text-blue-600 font-medium uppercase tracking-wide">
            {product.category_name}
          </span>
        )}
        <Link href={`/products/${product.id}`}>
          <h3 className="text-gray-900 font-semibold mt-1 hover:text-blue-600 transition">
            {product.name}
          </h3>
        </Link>
        <p className="text-gray-500 text-sm mt-1 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xl font-bold text-gray-900">${product.price}</span>
          <button
            onClick={addToCart}
            disabled={product.stock === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
