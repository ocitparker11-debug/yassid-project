import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck, Save, Search } from 'lucide-react';
import { apiFetch, formatIndonesianDate } from '../../lib/api';
import { MAJOR_LABELS } from '../../types';
import type { MajorCode, Student, StudentAttendance, StudentAttendanceStatus } from '../../types';

interface DraftAttendanceRow {
  status: StudentAttendanceStatus;
  note: string;
}

const STATUS_OPTIONS: StudentAttendanceStatus[] = ['Hadir', 'Sakit', 'Izin', 'Alpha'];
const MAJORS: MajorCode[] = ['TKJ', 'DKV', 'AK', 'BC', 'MPLB', 'BD'];

export default function StudentAttendancePage() {
  const [date, setDate] = useState(() =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  );
  const [students, setStudents] = useState<Student[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftAttendanceRow>>({});
  const [jurusanFilter, setJurusanFilter] = useState<string>('ALL');
  const [kelasFilter, setKelasFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const loadData = useCallback(async (targetDate: string) => {
    setLoading(true);
    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        apiFetch<{ students: Student[] }>('/api/students'),
        apiFetch<{ records: StudentAttendance[] }>(`/api/attendance/students?date=${targetDate}`),
      ]);

      setStudents(studentsRes.students);

      const map: Record<string, DraftAttendanceRow> = {};
      const existingByStudent = new Map(attendanceRes.records.map((r) => [r.studentId, r]));

      studentsRes.students.forEach((student) => {
        const existing = existingByStudent.get(student.id);
        map[student.id] = {
          status: existing ? existing.status : 'Hadir',
          note: existing ? existing.note : '',
        };
      });

      setDrafts(map);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat daftar siswa.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(date);
  }, [date, loadData]);

  const availableClasses = useMemo(() => {
    const base =
      jurusanFilter === 'ALL' ? students : students.filter((s) => s.jurusan === jurusanFilter);
    return Array.from(new Set(base.map((s) => s.kelas))).sort();
  }, [students, jurusanFilter]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (jurusanFilter !== 'ALL' && s.jurusan !== jurusanFilter) return false;
      if (kelasFilter !== 'ALL' && s.kelas !== kelasFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !s.nama.toLowerCase().includes(q) &&
          !s.nis.toLowerCase().includes(q) &&
          !s.kelas.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [students, jurusanFilter, kelasFilter, search]);

  const updateRow = (studentId: string, patch: Partial<DraftAttendanceRow>) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status || 'Hadir',
        note: prev[studentId]?.note || '',
        ...patch,
      },
    }));
  };

  const markVisiblePresent = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      filteredStudents.forEach((s) => {
        next[s.id] = {
          status: 'Hadir',
          note: next[s.id]?.note || '',
        };
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (filteredStudents.length === 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      const payload = filteredStudents.map((s) => ({
        studentId: s.id,
        status: drafts[s.id]?.status || 'Hadir',
        note: drafts[s.id]?.note || '',
      }));

      const res = await apiFetch<{ savedCount: number }>('/api/attendance/students/bulk', {
        method: 'POST',
        body: JSON.stringify({ date, records: payload }),
      });

      setFeedback({
        type: 'success',
        text: `Berhasil menyimpan absensi ${res.savedCount} siswa untuk tanggal ${formatIndonesianDate(date)}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan absensi siswa.',
      });
    } finally {
      setSaving(false);
    }
  };

  const summaryCounts = useMemo(() => {
    const counts = { Hadir: 0, Sakit: 0, Izin: 0, Alpha: 0 };
    filteredStudents.forEach((s) => {
      const st = drafts[s.id]?.status || 'Hadir';
      counts[st] += 1;
    });
    return counts;
  }, [filteredStudents, drafts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Absensi Siswa Harian
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Pilih tanggal dan kelas untuk mencatat status kehadiran siswa ({formatIndonesianDate(date)}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={markVisiblePresent}
            disabled={loading || filteredStudents.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4 text-emerald-600" />
            <span>Tandai Semua Hadir</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || filteredStudents.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Absensi'}</span>
          </button>
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

      {/* Filters Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label htmlFor="att-date" className="block text-xs font-semibold text-slate-600 mb-1.5">
            Tanggal Absensi
          </label>
          <input
            id="att-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
          />
        </div>

        <div>
          <label htmlFor="att-jurusan" className="block text-xs font-semibold text-slate-600 mb-1.5">
            Kompetensi Keahlian
          </label>
          <select
            id="att-jurusan"
            value={jurusanFilter}
            onChange={(e) => {
              setJurusanFilter(e.target.value);
              setKelasFilter('ALL');
            }}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-red-600"
          >
            <option value="ALL">Semua Jurusan</option>
            {MAJORS.map((code) => (
              <option key={code} value={code}>
                {code} — {MAJOR_LABELS[code]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="att-kelas" className="block text-xs font-semibold text-slate-600 mb-1.5">
            Kelas
          </label>
          <select
            id="att-kelas"
            value={kelasFilter}
            onChange={(e) => setKelasFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-red-600"
          >
            <option value="ALL">Semua Kelas</option>
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="att-search" className="block text-xs font-semibold text-slate-600 mb-1.5">
            Cari Siswa / NIS
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="att-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nama atau NIS..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600"
            />
          </div>
        </div>
      </section>

      {/* Live Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Hadir</span>
          <span className="font-mono text-lg font-bold text-emerald-700 tabular-nums">
            {summaryCounts.Hadir}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Sakit</span>
          <span className="font-mono text-lg font-bold text-orange-700 tabular-nums">
            {summaryCounts.Sakit}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Izin</span>
          <span className="font-mono text-lg font-bold text-sky-700 tabular-nums">
            {summaryCounts.Izin}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Alpha</span>
          <span className="font-mono text-lg font-bold text-red-600 tabular-nums">
            {summaryCounts.Alpha}
          </span>
        </div>
      </div>

      {/* Attendance Marking Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">NIS</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-4">Kelas / Jurusan</th>
                <th className="py-3 px-4">Status Kehadiran</th>
                <th className="py-3 px-4">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Memuat data siswa...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Tidak ada siswa yang sesuai dengan filter saat ini.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const row = drafts[student.id] || { status: 'Hadir', note: '' };
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {student.nis}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {student.nama}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {student.kelas} · {student.jurusan}
                      </td>
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                          {STATUS_OPTIONS.map((opt) => {
                            const active = row.status === opt;
                            const activeStyle =
                              opt === 'Hadir'
                                ? 'bg-emerald-600 text-white'
                                : opt === 'Sakit'
                                  ? 'bg-orange-600 text-white'
                                  : opt === 'Izin'
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-red-600 text-white';
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => updateRow(student.id, { status: opt })}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                                  active
                                    ? activeStyle
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4 min-w-[200px]">
                        <input
                          type="text"
                          value={row.note}
                          onChange={(e) => updateRow(student.id, { note: e.target.value })}
                          placeholder="Catatan opsional..."
                          className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-red-600"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
