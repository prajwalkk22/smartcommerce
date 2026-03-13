'use client';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between shadow-lg">
      <Link href="/products" className="text-xl font-bold text-blue-400">
        SmartCommerce
      </Link>
      <div className="flex items-center gap-6">
        <Link href="/products" className="hover:text-blue-400 transition">Products</Link>
        {user ? (
          <>
            <Link href="/cart" className="hover:text-blue-400 transition">Cart</Link>
            <Link href="/orders" className="hover:text-blue-400 transition">Orders</Link>
            {user.role === 'admin' && (
              <Link href="/admin" className="hover:text-yellow-400 text-yellow-300 transition font-medium">
                Admin
              </Link>
            )}
            <span className="text-gray-400 text-sm">Hi, {user.name}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm transition"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="hover:text-blue-400 transition">Login</Link>
            <Link href="/register" className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm transition">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
