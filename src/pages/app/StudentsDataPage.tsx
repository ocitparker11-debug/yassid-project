import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { MAJOR_LABELS } from '../../types';
import type { MajorCode, Student } from '../../types';

const MAJORS: MajorCode[] = ['TKJ', 'DKV', 'AK', 'BC', 'MPLB', 'BD'];

export default function StudentsDataPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [jurusanFilter, setJurusanFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [nis, setNis] = useState('');
  const [nama, setNama] = useState('');
  const [kelas, setKelas] = useState('');
  const [jurusan, setJurusan] = useState<MajorCode>('TKJ');
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (jurusanFilter !== 'ALL') params.set('jurusan', jurusanFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await apiFetch<{ students: Student[] }>(`/api/students?${params.toString()}`);
      setStudents(res.students);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat data siswa.',
      });
    } finally {
      setLoading(false);
    }
  }, [jurusanFilter, search]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const openAddModal = () => {
    setEditingStudent(null);
    setNis('');
    setNama('');
    setKelas('X TKJ 1');
    setJurusan('TKJ');
    setModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setNis(student.nis);
    setNama(student.nama);
    setKelas(student.kelas);
    setJurusan(student.jurusan);
    setModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      if (editingStudent) {
        await apiFetch(`/api/students/${editingStudent.id}`, {
          method: 'PUT',
          body: JSON.stringify({ nis, nama, kelas, jurusan }),
        });
        setFeedback({ type: 'success', text: `Data siswa ${nama} berhasil diperbarui.` });
      } else {
        await apiFetch('/api/students', {
          method: 'POST',
          body: JSON.stringify({ nis, nama, kelas, jurusan }),
        });
        setFeedback({ type: 'success', text: `Siswa baru ${nama} berhasil ditambahkan.` });
      }
      setModalOpen(false);
      await loadStudents();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan data siswa.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!deletingStudent) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiFetch(`/api/students/${deletingStudent.id}`, { method: 'DELETE' });
      setFeedback({
        type: 'success',
        text: `Data siswa ${deletingStudent.nama} berhasil dihapus.`,
      });
      setDeletingStudent(null);
      await loadStudents();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menghapus siswa.',
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
            Data Master Siswa
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Kelola NIS, nama lengkap, kelas, dan kompetensi keahlian siswa untuk keperluan absensi
            oleh guru.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Siswa</span>
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
            placeholder="Cari NIS, nama siswa, atau kelas..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
          />
        </div>
        <select
          value={jurusanFilter}
          onChange={(e) => setJurusanFilter(e.target.value)}
          className="sm:w-64 px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-red-600"
        >
          <option value="ALL">Semua Jurusan</option>
          {MAJORS.map((m) => (
            <option key={m} value={m}>
              {m} — {MAJOR_LABELS[m]}
            </option>
          ))}
        </select>
      </section>

      {/* Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">NIS</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Jurusan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Memuat data siswa...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Belum ada data siswa yang cocok.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {student.nis}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{student.nama}</td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                      {student.kelas}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <span className="font-mono font-semibold text-red-600">{student.jurusan}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{MAJOR_LABELS[student.jurusan]}</span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(student)}
                          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          aria-label={`Edit ${student.nama}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingStudent(student)}
                          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          aria-label={`Hapus ${student.nama}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add/Edit Student Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-900">
                {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
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

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div>
                <label htmlFor="s-nis" className="block text-sm font-semibold text-slate-700 mb-1">
                  NIS
                </label>
                <input
                  id="s-nis"
                  type="text"
                  required
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  placeholder="Contoh: 20241009"
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label htmlFor="s-nama" className="block text-sm font-semibold text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  id="s-nama"
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Nama lengkap siswa"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="s-jurusan" className="block text-sm font-semibold text-slate-700 mb-1">
                    Jurusan
                  </label>
                  <select
                    id="s-jurusan"
                    value={jurusan}
                    onChange={(e) => setJurusan(e.target.value as MajorCode)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-red-600"
                  >
                    {MAJORS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="s-kelas" className="block text-sm font-semibold text-slate-700 mb-1">
                    Kelas
                  </label>
                  <input
                    id="s-kelas"
                    type="text"
                    required
                    value={kelas}
                    onChange={(e) => setKelas(e.target.value)}
                    placeholder="Contoh: X TKJ 1"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
                  />
                </div>
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
                  {submitting ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Data Siswa?</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Anda akan menghapus <strong>{deletingStudent.nama}</strong> (NIS{' '}
              <span className="font-mono">{deletingStudent.nis}</span>). Riwayat absensi siswa ini
              juga akan dihapus. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteStudent}
                disabled={submitting}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {submitting ? 'Menghapus...' : 'Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
