import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, formatShortDate } from '../../lib/api';
import { ROLE_LABELS } from '../../types';
import type { Role, UserProfile } from '../../types';

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Add/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('guru');
  const [nip, setNip] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Hard Delete Modal
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ users: UserProfile[] }>('/api/users');
      setUsers(res.users);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat daftar pengguna.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !u.nama.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q) &&
          !u.nip.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [users, roleFilter, search]);

  const openAddModal = () => {
    setEditingUser(null);
    setNama('');
    setEmail('');
    setPassword('');
    setRole('guru');
    setNip('');
    setJabatan('');
    setModalOpen(true);
  };

  const openEditModal = (u: UserProfile) => {
    setEditingUser(u);
    setNama(u.nama);
    setEmail(u.email);
    setPassword('');
    setRole(u.role);
    setNip(u.nip === '-' ? '' : u.nip);
    setJabatan(u.jabatan);
    setModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      if (editingUser) {
        await apiFetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            nama,
            email,
            role,
            nip: nip || '-',
            jabatan,
            ...(password ? { password } : {}),
          }),
        });
        setFeedback({
          type: 'success',
          text: `Data dan akun autentikasi untuk ${nama} berhasil diperbarui.`,
        });
      } else {
        await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            nama,
            email,
            password,
            role,
            nip: nip || '-',
            jabatan,
          }),
        });
        setFeedback({
          type: 'success',
          text: `Pengguna ${nama} (${ROLE_LABELS[role]}) berhasil dibuat dan tersinkronisasi dengan sistem autentikasi.`,
        });
      }
      setModalOpen(false);
      await loadUsers();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan data pengguna.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleHardDelete = async () => {
    if (!deletingUser) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiFetch(`/api/users/${deletingUser.id}`, { method: 'DELETE' });
      setFeedback({
        type: 'success',
        text: `Pengguna ${deletingUser.nama} dan seluruh kredensial autentikasinya telah dihapus permanen.`,
      });
      setDeletingUser(null);
      await loadUsers();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menghapus pengguna.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            User Management
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Tambah, ubah peran, atau hapus akun secara permanen tersinkronisasi dengan sistem
            autentikasi sekolah.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah User Baru</span>
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-4 rounded-lg border text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Search & Filter */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, email, atau NIP..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="sm:w-56 px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-red-600"
        >
          <option value="ALL">Semua Role</option>
          <option value="admin">Admin</option>
          <option value="guru">Guru</option>
          <option value="tenaga_kependidikan">Tenaga Kependidikan</option>
        </select>
      </section>

      {/* Users Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Nama &amp; Jabatan</th>
                <th className="py-3 px-4">Email Autentikasi</th>
                <th className="py-3 px-4">NIP</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Terdaftar</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Memuat daftar pengguna...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Tidak ada pengguna yang cocok.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">
                          {u.nama} {isSelf && <span className="text-xs text-red-600">(Anda)</span>}
                        </p>
                        <p className="text-xs text-slate-500">{u.jabatan}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 font-mono">{u.email}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 font-mono tabular-nums whitespace-nowrap">
                        {u.nip}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold whitespace-nowrap">
                        <span
                          className={
                            u.role === 'admin'
                              ? 'text-red-600'
                              : u.role === 'guru'
                                ? 'text-slate-900'
                                : 'text-slate-600'
                          }
                        >
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {formatShortDate(u.createdAt.slice(0, 10))}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            aria-label={`Edit ${u.nama}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => setDeletingUser(u)}
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label={`Hapus permanen ${u.nama}`}
                            title={
                              isSelf
                                ? 'Tidak dapat menghapus akun yang sedang aktif'
                                : 'Hapus permanen user & auth'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add/Edit User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-900">
                {editingUser ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label htmlFor="u-nama" className="block text-sm font-semibold text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  id="u-nama"
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Nama lengkap dengan gelar"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="u-email" className="block text-sm font-semibold text-slate-700 mb-1">
                    Email Autentikasi
                  </label>
                  <input
                    id="u-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@smkprimaunggul.sch.id"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
                  />
                </div>
                <div>
                  <label htmlFor="u-role" className="block text-sm font-semibold text-slate-700 mb-1">
                    Role Akses
                  </label>
                  <select
                    id="u-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-red-600"
                  >
                    <option value="admin">Admin</option>
                    <option value="guru">Guru</option>
                    <option value="tenaga_kependidikan">Tenaga Kependidikan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="u-nip" className="block text-sm font-semibold text-slate-700 mb-1">
                    NIP / NUPTK
                  </label>
                  <input
                    id="u-nip"
                    type="text"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    placeholder="Opsional"
                    className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
                  />
                </div>
                <div>
                  <label htmlFor="u-jabatan" className="block text-sm font-semibold text-slate-700 mb-1">
                    Jabatan
                  </label>
                  <input
                    id="u-jabatan"
                    type="text"
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                    placeholder="Contoh: Guru Produktif DKV"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="u-pass" className="block text-sm font-semibold text-slate-700 mb-1">
                  {editingUser ? 'Kata Sandi Baru (Kosongkan jika tidak diubah)' : 'Kata Sandi'}
                </label>
                <input
                  id="u-pass"
                  type="password"
                  required={!editingUser}
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : editingUser ? 'Simpan Perubahan' : 'Buat User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hard Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Hapus Permanen Pengguna &amp; Akun Autentikasi?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Anda akan melakukan <strong>hard delete</strong> terhadap{' '}
              <strong>{deletingUser.nama}</strong> ({deletingUser.email}). Seluruh kredensial login,
              sesi aktif, dan riwayat absensi karyawan pengguna ini akan dihapus permanen.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleHardDelete}
                disabled={submitting}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {submitting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
