import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { StatusText } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, formatIndonesianDate, formatShortDate } from '../../lib/api';
import { ROLE_LABELS } from '../../types';
import type { DashboardData } from '../../types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(() =>
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date())
  );

  const loadDashboard = useCallback(async () => {
    try {
      setError('');
      const res = await apiFetch<DashboardData>('/api/dashboard');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat ringkasan dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(
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

  if (!user) return null;

  return (
    <div className="space-y-8">
      {/* Top Welcome & Self-Attendance Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-semibold text-red-600 mb-1">
            {ROLE_LABELS[user.role]} · {user.jabatan}
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Selamat Datang, {user.nama}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {data ? formatIndonesianDate(data.today) : 'Memuat tanggal...'} · Waktu Jakarta{' '}
            <span className="font-mono font-semibold text-slate-900 tabular-nums">{clock}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6 shrink-0">
          {loading ? (
            <div className="h-10 w-44 bg-slate-100 animate-pulse rounded-lg" />
          ) : data?.myAttendanceToday ? (
            <div>
              <p className="text-xs text-slate-500">Status Absen Anda Hari Ini</p>
              <div className="flex items-center gap-2 mt-1">
                <StatusText status={data.myAttendanceToday.status} />
                {data.myAttendanceToday.checkInTime && (
                  <span className="font-mono text-xs text-slate-600 tabular-nums">
                    Masuk {data.myAttendanceToday.checkInTime}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Clock className="w-4 h-4 text-red-600 shrink-0" />
              <span>Anda belum absen masuk hari ini</span>
            </div>
          )}

          <Link
            to="/app/absensi-karyawan"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <span>{data?.myAttendanceToday ? 'Lihat Absensi Saya' : 'Absen Sekarang'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {error && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* KPI Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500">Kehadiran Saya Bulan Ini</p>
          <p className="font-mono text-3xl font-bold text-slate-900 tabular-nums mt-2">
            {loading ? '—' : data?.stats.myMonthlyPresent ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            dari {loading ? '—' : data?.stats.myMonthlyTotal ?? 0} hari tercatat
          </p>
        </div>

        {user.role === 'admin' ? (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-500">Karyawan Hadir Hari Ini</p>
              <p className="font-mono text-3xl font-bold text-red-600 tabular-nums mt-2">
                {loading ? '—' : data?.stats.employeesPresentToday ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                dari {loading ? '—' : data?.stats.totalEmployees ?? 0} total karyawan
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-500">Siswa Hadir Hari Ini</p>
              <p className="font-mono text-3xl font-bold text-slate-900 tabular-nums mt-2">
                {loading ? '—' : data?.stats.studentsPresentToday ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                dari {loading ? '—' : data?.stats.studentsRecordedToday ?? 0} siswa diabsen hari ini
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-500">Total Siswa Terdaftar</p>
              <p className="font-mono text-3xl font-bold text-slate-900 tabular-nums mt-2">
                {loading ? '—' : data?.stats.totalStudents ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                6 kompetensi keahlian aktif
              </p>
            </div>
          </>
        ) : user.role === 'guru' ? (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-500">Siswa Hadir Hari Ini</p>
              <p className="font-mono text-3xl font-bold text-red-600 tabular-nums mt-2">
                {loading ? '—' : data?.stats.studentsPresentToday ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                dari {loading ? '—' : data?.stats.studentsRecordedToday ?? 0} siswa diabsen
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-500">Total Siswa Sekolah</p>
              <p className="font-mono text-3xl font-bold text-slate-900 tabular-nums mt-2">
                {loading ? '—' : data?.stats.totalStudents ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Siap diabsen per kelas &amp; jurusan
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Tugas Harian Guru</p>
                <p className="text-sm font-bold text-slate-900 mt-2">
                  Input Presensi Kelas
                </p>
              </div>
              <Link
                to="/app/absensi-siswa"
                className="text-xs font-semibold text-red-600 hover:text-red-700 mt-3 inline-flex items-center gap-1"
              >
                <span>Buka Absensi Siswa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-500">Status Hari Ini</p>
              <p className="text-xl font-bold text-slate-900 mt-2">
                {data?.myAttendanceToday ? data.myAttendanceToday.status : 'Belum Tercatat'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {data?.myAttendanceToday?.checkInTime
                  ? `Masuk pukul ${data.myAttendanceToday.checkInTime}`
                  : 'Lakukan absensi masuk mandiri'}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-500">Jam Kerja Standar</p>
              <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-2">
                07:00 – 15:30
              </p>
              <p className="text-xs text-slate-500 mt-1">Batas tepat waktu pukul 07:30 WIB</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Akses Cepat</p>
                <p className="text-sm font-bold text-slate-900 mt-2">
                  Riwayat Kehadiran Pribadi
                </p>
              </div>
              <Link
                to="/app/absensi-karyawan"
                className="text-xs font-semibold text-red-600 hover:text-red-700 mt-3 inline-flex items-center gap-1"
              >
                <span>Kelola Absensi Karyawan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </>
        )}
      </section>

      {/* Recent Attendance Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <h3 className="text-base font-bold text-slate-900">
              {user.role === 'admin'
                ? 'Aktivitas Absensi Karyawan Terbaru'
                : 'Riwayat Absensi Karyawan Anda'}
            </h3>
            <Link
              to={user.role === 'admin' ? '/app/rekap-absensi/karyawan' : '/app/absensi-karyawan'}
              className="text-xs font-semibold text-red-600 hover:text-red-700 whitespace-nowrap"
            >
              Lihat Semua
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Tanggal</th>
                  {user.role === 'admin' && <th className="py-3 px-4">Nama Karyawan</th>}
                  <th className="py-3 px-4">Masuk</th>
                  <th className="py-3 px-4">Pulang</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Memuat data absensi...
                    </td>
                  </tr>
                ) : !data?.recentEmployeeAttendance.length ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Belum ada catatan absensi karyawan.
                    </td>
                  </tr>
                ) : (
                  data.recentEmployeeAttendance.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {formatShortDate(row.date)}
                      </td>
                      {user.role === 'admin' && (
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {row.userName}
                        </td>
                      )}
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums">
                        {row.checkInTime || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums">
                        {row.checkOutTime || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusText status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {user.role !== 'tenaga_kependidikan' && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <h3 className="text-base font-bold text-slate-900">
                Catatan Absensi Siswa Terbaru
              </h3>
              <Link
                to="/app/rekap-absensi/siswa"
                className="text-xs font-semibold text-red-600 hover:text-red-700 whitespace-nowrap"
              >
                Lihat Rekap
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Siswa</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        Memuat data absensi siswa...
                      </td>
                    </tr>
                  ) : !data?.recentStudentAttendance.length ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        Belum ada catatan absensi siswa.
                      </td>
                    </tr>
                  ) : (
                    data.recentStudentAttendance.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                          {formatShortDate(row.date)}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{row.studentName}</p>
                          <p className="font-mono text-xs text-slate-500 tabular-nums">{row.nis}</p>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                          {row.kelas}
                        </td>
                        <td className="py-3 px-4">
                          <StatusText status={row.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {user.role === 'tenaga_kependidikan' && (
          <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Panduan Presensi Tenaga Kependidikan
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Seluruh tenaga kependidikan wajib mencatat kehadiran masuk dan pulang secara mandiri
                melalui menu Absensi Karyawan. Pencatatan di atas pukul 07:30 WIB otomatis tercatat
                sebagai Terlambat.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <Link
                to="/app/absensi-karyawan"
                className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700"
              >
                <span>Buka Menu Absensi Karyawan</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
