import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, LogOut } from 'lucide-react';
import { StatusText } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, formatIndonesianDate, formatShortDate } from '../../lib/api';
import { ROLE_LABELS } from '../../types';
import type { EmployeeAttendance, EmployeeAttendanceStatus } from '../../types';

export default function EmployeeAttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<EmployeeAttendance[]>([]);
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<EmployeeAttendanceStatus>('Hadir');
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [liveTime, setLiveTime] = useState(() =>
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date())
  );

  const loadMyRecords = useCallback(async () => {
    try {
      const res = await apiFetch<{ records: EmployeeAttendance[]; today: string }>(
        '/api/attendance/employees?scope=self'
      );
      setRecords(res.records);
      setToday(res.today);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat riwayat absensi Anda.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyRecords();
  }, [loadMyRecords]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveTime(
        new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date())
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const todayRecord = records.find((r) => r.date === today) || null;

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiFetch<{ record: EmployeeAttendance }>('/api/attendance/employees/check-in', {
        method: 'POST',
        body: JSON.stringify({ status: selectedStatus, note }),
      });
      setNote('');
      setFeedback({ type: 'success', text: 'Absen masuk hari ini berhasil dicatat.' });
      await loadMyRecords();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mencatat absensi masuk.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiFetch<{ record: EmployeeAttendance }>('/api/attendance/employees/check-out', {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      setNote('');
      setFeedback({ type: 'success', text: 'Absen pulang hari ini berhasil dicatat.' });
      await loadMyRecords();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mencatat absensi pulang.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Absensi Karyawan Mandiri
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {user.nama} · {ROLE_LABELS[user.role]} · NIP {user.nip}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-medium text-slate-500">
            {today ? formatIndonesianDate(today) : 'Hari Ini'}
          </p>
          <p className="font-mono text-2xl font-bold text-red-600 tabular-nums">{liveTime} WIB</p>
        </div>
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

      {/* Self Attendance Action Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="h-32 bg-slate-100 animate-pulse rounded-lg" />
        ) : !todayRecord ? (
          <form onSubmit={handleCheckIn} className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Catat Kehadiran Hari Ini
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih status kehadiran dan tambahkan catatan jika diperlukan.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <Clock className="w-4 h-4" />
                <span>Belum Absen Masuk</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
              <div className="md:col-span-5">
                <span className="block text-xs font-semibold text-slate-700 mb-2">
                  Status Kehadiran
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['Hadir', 'Izin', 'Sakit'] as const).map((statusOption) => (
                    <button
                      key={statusOption}
                      type="button"
                      onClick={() => setSelectedStatus(statusOption)}
                      className={`py-2.5 px-3 text-sm font-semibold rounded-lg border transition-colors cursor-pointer ${
                        selectedStatus === statusOption
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-red-400'
                      }`}
                    >
                      {statusOption}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-4">
                <label htmlFor="emp-note" className="block text-xs font-semibold text-slate-700 mb-2">
                  Keterangan / Catatan
                </label>
                <input
                  id="emp-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Contoh: Hadir tepat waktu / izin keperluan keluarga"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/15"
                />
              </div>

              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Catat Absen Masuk'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-slate-900">Ringkasan Absen Hari Ini</h3>
                <StatusText status={todayRecord.status} />
              </div>
              <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
                <span>
                  Jam Masuk:{' '}
                  <strong className="font-mono text-slate-900 tabular-nums">
                    {todayRecord.checkInTime || '—'}
                  </strong>
                </span>
                <span>
                  Jam Pulang:{' '}
                  <strong className="font-mono text-slate-900 tabular-nums">
                    {todayRecord.checkOutTime || 'Belum absen pulang'}
                  </strong>
                </span>
              </div>
              {todayRecord.note && (
                <p className="text-xs text-slate-500">Catatan: {todayRecord.note}</p>
              )}
            </div>

            {todayRecord.status !== 'Izin' &&
            todayRecord.status !== 'Sakit' &&
            !todayRecord.checkOutTime ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Catatan pulang (opsional)"
                  className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
                />
                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-red-600 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{submitting ? 'Menyimpan...' : 'Catat Absen Pulang'}</span>
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>Presensi hari ini telah lengkap</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Personal Attendance History Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Riwayat Kehadiran Anda</h3>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {records.length} catatan
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Jam Masuk</th>
                <th className="py-3 px-4">Jam Pulang</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Memuat riwayat absensi...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Belum ada riwayat absensi tercatat.
                  </td>
                </tr>
              ) : (
                records.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs text-slate-800 tabular-nums whitespace-nowrap">
                      {formatShortDate(item.date)}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums">
                      {item.checkInTime || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums">
                      {item.checkOutTime || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={item.status} />
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {item.note || '—'}
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
