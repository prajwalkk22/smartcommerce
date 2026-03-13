'use client';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import SearchBar from './SearchBar';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className="bg-gray-900 text-white px-6 py-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center gap-6">
        <Link href="/products" className="text-xl font-bold text-blue-400 flex-shrink-0">
          SmartCommerce
        </Link>

        {/* Search bar in navbar */}
        <div className="flex-1 max-w-lg">
          <SearchBar />
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <Link href="/products" className="hover:text-blue-400 transition text-sm">Products</Link>
          {user ? (
            <>
              <Link href="/cart" className="hover:text-blue-400 transition text-sm">Cart</Link>
              <Link href="/orders" className="hover:text-blue-400 transition text-sm">Orders</Link>
              {user.role === 'admin' && (
                <Link href="/admin" className="text-yellow-300 hover:text-yellow-400 transition text-sm font-medium">
                  Admin
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-blue-400 transition text-sm">Login</Link>
              <Link href="/register" className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm transition">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
