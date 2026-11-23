import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { StatusText } from '../../components/StatusText';
import { apiFetch, exportCsv, formatShortDate } from '../../lib/api';
import { ROLE_LABELS } from '../../types';
import type { EmployeeAttendance } from '../../types';

export default function RecapEmployeePage() {
  const [records, setRecords] = useState<EmployeeAttendance[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await apiFetch<{ records: EmployeeAttendance[] }>(
        `/api/attendance/employees?${params.toString()}`
      );
      setRecords(res.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat rekap absensi karyawan.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, roleFilter, statusFilter, search]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const counts = useMemo(() => {
    return records.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      },
      { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0 } as Record<string, number>
    );
  }, [records]);

  const handleExport = () => {
    exportCsv(
      'rekap-absensi-karyawan-smk-prima-unggul.csv',
      ['Tanggal', 'NIP', 'Nama Karyawan', 'Peran', 'Jam Masuk', 'Jam Pulang', 'Status', 'Keterangan'],
      records.map((r) => [
        r.date,
        r.userNip,
        r.userName,
        ROLE_LABELS[r.userRole],
        r.checkInTime || '-',
        r.checkOutTime || '-',
        r.status,
        r.note,
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Rekap Absensi Karyawan
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Laporan kehadiran seluruh Admin, Guru, dan Tenaga Kependidikan SMK Prima Unggul.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={records.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download CSV</span>
        </button>
      </div>

      {/* Filters */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label htmlFor="emp-start" className="block text-xs font-semibold text-slate-600 mb-1.5">
            Dari Tanggal
          </label>
          <input
            id="emp-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
          />
        </div>

        <div>
          <label htmlFor="emp-end" className="block text-xs font-semibold text-slate-600 mb-1.5">
            Sampai Tanggal
          </label>
          <input
            id="emp-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
          />
        </div>

        <div>
          <label htmlFor="emp-role" className="block text-xs font-semibold text-slate-600 mb-1.5">
            Peran
          </label>
          <select
            id="emp-role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-red-600"
          >
            <option value="ALL">Semua Peran</option>
            <option value="admin">Admin</option>
            <option value="guru">Guru</option>
            <option value="tenaga_kependidikan">Tenaga Kependidikan</option>
          </select>
        </div>

        <div>
          <label htmlFor="emp-status" className="block text-xs font-semibold text-slate-600 mb-1.5">
            Status
          </label>
          <select
            id="emp-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-red-600"
          >
            <option value="ALL">Semua Status</option>
            <option value="Hadir">Hadir</option>
            <option value="Terlambat">Terlambat</option>
            <option value="Izin">Izin</option>
            <option value="Sakit">Sakit</option>
          </select>
        </div>

        <div>
          <label htmlFor="emp-search" className="block text-xs font-semibold text-slate-600 mb-1.5">
            Cari Karyawan
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="emp-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nama atau NIP..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
            />
          </div>
        </div>
      </section>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Hadir</span>
          <span className="font-mono text-lg font-bold text-emerald-700 tabular-nums">
            {counts.Hadir}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Terlambat</span>
          <span className="font-mono text-lg font-bold text-amber-700 tabular-nums">
            {counts.Terlambat}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Izin</span>
          <span className="font-mono text-lg font-bold text-sky-700 tabular-nums">
            {counts.Izin}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Sakit</span>
          <span className="font-mono text-lg font-bold text-orange-700 tabular-nums">
            {counts.Sakit}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Nama Karyawan</th>
                <th className="py-3 px-4">Peran</th>
                <th className="py-3 px-4">Jam Masuk</th>
                <th className="py-3 px-4">Jam Pulang</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Memuat rekap absensi karyawan...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Tidak ada data absensi karyawan yang ditemukan.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {formatShortDate(r.date)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{r.userName}</p>
                      <p className="font-mono text-xs text-slate-500 tabular-nums">{r.userNip}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {ROLE_LABELS[r.userRole]}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums">
                      {r.checkInTime || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums">
                      {r.checkOutTime || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={r.status} />
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {r.note || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
