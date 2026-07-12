import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Users,
  Plus,
  Trash2,
  Shield,
  UserCheck,
  Store,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Store {
  id: string;
  name: string;
}

interface AdminData {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'MANAGER';
  createdAt: string;
  stores: { store: Store }[];
}

export default function AdminStaff() {
  const [admins, setAdmins] = useState<AdminData[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'MANAGER' as 'SUPER_ADMIN' | 'MANAGER',
    storeIds: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  const fetchAdmins = async () => {
    const res = await api.get('/admin/admins');
    setAdmins(res.data.data || []);
  };

  const fetchStores = async () => {
    const res = await api.get('/stores');
    setStores(res.data.data || []);
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      await Promise.all([fetchAdmins(), fetchStores()]);
    } catch (err: any) {
      setLoadError(err.response?.data?.error || 'Unable to load staff data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.password || form.storeIds.length === 0) {
      setError('All fields required. Select at least one store.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.post('/admin/admins', form);
      await fetchAdmins();
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'MANAGER', storeIds: [] });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create admin');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (adminId: string) => {
    if (!confirm('Delete this admin user?')) return;
    try {
      await api.delete(`/admin/admins/${adminId}`);
      await fetchAdmins();
    } catch {
      alert('Delete failed');
    }
  };

  const toggleStore = (storeId: string) => {
    setForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(storeId)
        ? f.storeIds.filter((id) => id !== storeId)
        : [...f.storeIds, storeId],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-brand-400" />
          <h2 className="text-lg font-bold text-white">Staff Management</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition',
            showForm
              ? 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
              : 'bg-brand-600 text-white hover:bg-brand-700'
          )}
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Staff'}
        </button>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          <span>{loadError}</span>
          <button onClick={() => void loadData()} className="text-xs font-semibold underline">Retry</button>
        </div>
      )}

      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white">Add New Staff</h3>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                placeholder="john@rollsandco.com"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'SUPER_ADMIN' | 'MANAGER' }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="MANAGER">Store Manager</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-2 block">Assigned Stores *</label>
            <div className="flex flex-wrap gap-2">
              {stores.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleStore(s.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition',
                    form.storeIds.includes(s.id)
                      ? 'bg-brand-900/40 text-brand-400 border-brand-800'
                      : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800'
                  )}
                >
                  {form.storeIds.includes(s.id) ? <Check className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:bg-gray-700 disabled:text-gray-400 transition"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Creating...' : 'Create Staff'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No staff found</div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-900/50 text-xs font-semibold text-gray-400 uppercase">
            <div className="col-span-3">Name</div>
            <div className="col-span-3 hidden md:block">Email</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-3">Stores</div>
            <div className="col-span-1 text-right"></div>
          </div>
          {admins.map((admin) => (
            <div
              key={admin.id}
              className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-gray-700 items-center"
            >
              <div className="col-span-3 text-sm text-white font-medium truncate">{admin.name}</div>
              <div className="col-span-3 hidden md:block text-sm text-gray-400 truncate">{admin.email}</div>
              <div className="col-span-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border',
                    admin.role === 'SUPER_ADMIN'
                      ? 'bg-purple-900/30 text-purple-400 border-purple-800'
                      : 'bg-blue-900/30 text-blue-400 border-blue-800'
                  )}
                >
                  {admin.role === 'SUPER_ADMIN' ? <Shield className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                  {admin.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Manager'}
                </span>
              </div>
              <div className="col-span-3 text-xs text-gray-400 truncate">
                {admin.stores.map((s) => s.store.name).join(', ') || 'All stores'}
              </div>
              <div className="col-span-1 text-right">
                <button
                  onClick={() => handleDelete(admin.id)}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-900/20 transition"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
