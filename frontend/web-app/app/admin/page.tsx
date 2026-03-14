'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const PRODUCT_SERVICE = process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL || 'https://product-service-be0f.onrender.com';

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '', category_id: '', image_url: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const authHeader = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/products');
  }, [user]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${PRODUCT_SERVICE}/api/products?limit=50`);
      setProducts(res.data.products);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${PRODUCT_SERVICE}/api/categories`);
      setCategories(res.data.categories);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'smartcommerce');
    formData.append('cloud_name', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '');

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      formData
    );
    return res.data.secure_url;
  };

  const handleSubmit = async () => {
    setUploading(true);
    try {
      let imageUrl = form.image_url;

      if (imageFile) {
        imageUrl = await uploadToCloudinary(imageFile);
      }

      const payload = { ...form, price: parseFloat(form.price), stock: parseInt(form.stock), image_url: imageUrl };

      if (editProduct) {
        await axios.put(`${PRODUCT_SERVICE}/api/products/${editProduct.id}`, payload, { headers: authHeader() });
      } else {
        await axios.post(`${PRODUCT_SERVICE}/api/products`, payload, { headers: authHeader() });
      }

      setShowModal(false);
      setEditProduct(null);
      setForm({ name: '', description: '', price: '', stock: '', category_id: '', image_url: '' });
      setImageFile(null);
      fetchProducts();
    } catch (err) {
      alert('Failed to save product');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await axios.delete(`${PRODUCT_SERVICE}/api/products/${id}`, { headers: authHeader() });
      fetchProducts();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  const openEdit = (product: any) => {
    setEditProduct(product);
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock: product.stock,
      category_id: product.category_id || '',
      image_url: product.image_url || '',
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditProduct(null);
    setForm({ name: '', description: '', price: '', stock: '', category_id: '', image_url: '' });
    setImageFile(null);
    setShowModal(true);
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin — Products</h1>
        <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition">
          + Add Product
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Price</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Stock</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product: any) => (
                <tr key={product.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.image_url || `https://picsum.photos/seed/${product.id}/40/40`}
                        alt={product.name}
                        className="w-10 h-10 rounded object-cover"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-gray-400 text-xs truncate max-w-xs">{product.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">${product.price}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.stock > 10 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{product.category_name || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(product)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                      <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editProduct ? 'Edit Product' : 'Add Product'}</h2>
            <div className="space-y-3">
              <input placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              <div className="flex gap-2">
                <input placeholder="Price" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input placeholder="Stock" type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <select value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">No Category</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100" />
                {(imageFile || form.image_url) && (
                  <img
                    src={imageFile ? URL.createObjectURL(imageFile) : form.image_url}
                    className="mt-2 h-20 w-20 object-cover rounded"
                    alt="preview"
                  />
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowModal(false); setImageFile(null); }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={uploading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-2 rounded-lg text-sm font-medium transition">
                {uploading ? 'Saving...' : editProduct ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
