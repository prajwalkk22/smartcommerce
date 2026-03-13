'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { searchAPI } from '../lib/api';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [popularSearches, setPopularSearches] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<any>(null);
  const wrapperRef = useRef<any>(null);
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced suggestions fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchAPI.suggestions(query);
        setSuggestions(res.data.suggestions || []);
        setPopularSearches(res.data.popular_searches || []);
        setShowDropdown(true);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  const handleSearch = (q: string) => {
    if (!q.trim()) return;
    setShowDropdown(false);
    setQuery(q);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch(query);
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl">
      <div className="flex items-center border border-gray-300 rounded-xl bg-white shadow-sm overflow-hidden">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          placeholder="Search products... (try typos!)"
          className="flex-1 px-4 py-2.5 text-sm focus:outline-none"
        />
        {loading && (
          <span className="px-3 text-gray-400 text-xs">...</span>
        )}
        <button
          onClick={() => handleSearch(query)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-medium transition"
        >
          Search
        </button>
      </div>

      {/* Suggestions Dropdown */}
      {showDropdown && (suggestions.length > 0 || popularSearches.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">

          {suggestions.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 px-4 pt-3 pb-1 uppercase tracking-wide font-medium">
                Products
              </p>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSearch(s.text)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition"
                >
                  <span className="text-gray-400">🔍</span>
                  {s.text}
                </button>
              ))}
            </div>
          )}

          {popularSearches.length > 0 && (
            <div className="border-t border-gray-100">
              <p className="text-xs text-gray-400 px-4 pt-3 pb-1 uppercase tracking-wide font-medium">
                Popular Searches
              </p>
              {popularSearches.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSearch(s.text)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-between transition"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-orange-400">🔥</span>
                    {s.text}
                  </span>
                  <span className="text-xs text-gray-400">{s.count} searches</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
