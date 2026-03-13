'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { searchAPI, productsAPI } from '../../lib/api';
import ProductCard from '../../components/ProductCard';
import SearchBar from '../../components/SearchBar';

function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState<any>(null);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState([]);
  const router = useRouter();

  useEffect(() => {
    productsAPI.categories().then(res => setCategories(res.data.categories));
    searchAPI.trending().then(res => setTrending(res.data.trending || []));
  }, []);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    searchAPI.search({ q, category, page, limit: 12 })
      .then(res => {
        setProducts(res.data.products);
        setPagination(res.data.pagination);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [q, category, page]);

  return (
    <div>
      {/* Search bar at top of results */}
      <div className="mb-6">
        <SearchBar />
      </div>

      {q ? (
        <>
          {/* Results header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Results for "<span className="text-blue-600">{q}</span>"
              </h1>
              {pagination && (
                <p className="text-sm text-gray-500 mt-1">{pagination.total} products found</p>
              )}
            </div>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat: any) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Results grid */}
          {loading ? (
            <div className="flex justify-center items-center h-64 text-gray-500">Searching...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg mb-2">No results for "{q}"</p>
              <p className="text-gray-400 text-sm">Try different keywords or check spelling</p>
              {trending.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-medium text-gray-600 mb-3">Trending searches:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {trending.map((t: any) => (
                      <button
                        key={t.query}
                        onClick={() => router.push(`/search?q=${encodeURIComponent(t.query)}`)}
                        className="bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-600 px-3 py-1 rounded-full text-sm transition"
                      >
                        {t.query}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    p === page ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        /* No query — show trending */
        trending.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-600 mb-3">🔥 Trending searches</p>
            <div className="flex flex-wrap gap-2">
              {trending.map((t: any) => (
                <button
                  key={t.query}
                  onClick={() => router.push(`/search?q=${encodeURIComponent(t.query)}`)}
                  className="bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-600 px-3 py-1 rounded-full text-sm transition"
                >
                  {t.query}
                  <span className="ml-1 text-xs text-gray-400">({t.search_count})</span>
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading...</div>}>
      <SearchResults />
    </Suspense>
  );
}
