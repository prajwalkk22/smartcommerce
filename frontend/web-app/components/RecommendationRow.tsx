'use client';
import { useEffect, useState } from 'react';
import ProductCard from './ProductCard';

interface Props {
  title: string;
  fetchFn: () => Promise<any>;
}

export default function RecommendationRow({ title, fetchFn }: Props) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFn()
      .then(res => setProducts(res.data.recommendations || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="mt-12">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
      <div className="flex gap-4 overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-xl h-64 w-48 animate-pulse flex-shrink-0" />
        ))}
      </div>
    </div>
  );

  if (products.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.slice(0, 4).map((product: any) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
