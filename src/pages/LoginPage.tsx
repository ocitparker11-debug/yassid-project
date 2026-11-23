import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, User, UserPlus } from 'lucide-react';
import { ResilientImage } from '../components/ResilientImage';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

type AuthMode = 'login' | 'register';

export default function LoginPage() {
  const { user, login, register, bootstrapDemo } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [registerRole, setRegisterRole] = useState<'guru' | 'tenaga_kependidikan'>('guru');
  const [showPassword, setShowPassword] = useState(false);
  const [hasUsers, setHasUsers] = useState(true);
  const [hasAdminKey, setHasAdminKey] = useState(true);
  const [backendMode, setBackendMode] = useState<
    'loading' | 'supabase-postgresql' | 'sqlite-relational'
  >('loading');
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    apiFetch<{
      hasUsers: boolean;
      backend?: 'supabase-postgresql' | 'sqlite-relational';
      hasAdminPrivileges?: boolean;
    }>('/api/auth/status')
      .then((res) => {
        setHasUsers(res.hasUsers);
        if (res.backend) setBackendMode(res.backend);
        if (typeof res.hasAdminPrivileges === 'boolean') {
          setHasAdminKey(res.hasAdminPrivileges);
        }
        if (!res.hasUsers) {
          setMode('register');
        }
      })
      .catch((err) => {
        setHasUsers(true);
        if (err instanceof Error && err.message && !err.message.includes('404')) {
          setError(err.message);
        }
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register({
          nama: nama.trim(),
          email: email.trim(),
          password,
          nip: nip.trim(),
          role: registerRole,
        });
      }
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses autentikasi.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setMode('login');
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
  };

  const handleBootstrapDemo = async () => {
    setError('');
    setBootstrapping(true);
    try {
      await bootstrapDemo();
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat akun awal di Supabase.');
    } finally {
      setBootstrapping(false);
    }
  };

  return (
    <div className="min-h-screen bg-white grid grid-cols-1 lg:grid-cols-12 items-stretch">
      {/* Left Form Panel */}
      <div className="lg:col-span-6 flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </Link>
          <span className="text-sm font-bold text-slate-900 whitespace-nowrap">
            SMK Prima Unggul
          </span>
        </div>

        <div className="w-full max-w-md mx-auto my-10">
          <div className="mb-8">
            <p className="text-sm font-semibold text-red-600 mb-2">
              Portal Sistem Absensi
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {mode === 'login' ? 'Masuk ke Akun Anda' : 'Pendaftaran Akun Baru'}
            </h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {mode === 'login'
                ? 'Gunakan email sekolah terdaftar untuk mengakses dashboard absensi karyawan dan siswa.'
                : !hasUsers
                  ? 'Belum ada pengguna terdaftar. Akun pertama otomatis ditetapkan sebagai Admin.'
                  : 'Daftarkan akun Guru atau Tenaga Kependidikan untuk mengakses portal presensi.'}
            </p>
          </div>

          {/* Mode Toggle Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`py-2 text-sm font-semibold rounded-md transition-colors ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`py-2 text-sm font-semibold rounded-md transition-colors ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Akun
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label htmlFor="nama" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="nama"
                      type="text"
                      required
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      placeholder="Contoh: Siti Nurhaliza, S.Kom."
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/15"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="nip" className="block text-sm font-semibold text-slate-700 mb-1.5">
                      NIP / NUPTK
                    </label>
                    <input
                      id="nip"
                      type="text"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      placeholder="Opsional"
                      className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/15"
                    />
                  </div>
                  <div>
                    <label htmlFor="role" className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Peran Pengguna
                    </label>
                    {!hasUsers ? (
                      <input
                        id="role"
                        type="text"
                        readOnly
                        value="Admin (Pengguna Pertama)"
                        className="w-full px-3.5 py-2.5 text-sm bg-red-50 text-red-700 font-semibold border border-red-200 rounded-lg"
                      />
                    ) : (
                      <select
                        id="role"
                        value={registerRole}
                        onChange={(e) =>
                          setRegisterRole(e.target.value as 'guru' | 'tenaga_kependidikan')
                        }
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/15"
                      >
                        <option value="guru">Guru</option>
                        <option value="tenaga_kependidikan">Tenaga Kependidikan</option>
                      </select>
                    )}
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Sekolah
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@smkprimaunggul.sch.id"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/15"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-10 pr-11 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {submitting
                ? 'Memproses...'
                : mode === 'login'
                  ? 'Masuk ke Aplikasi'
                  : 'Buat Akun & Masuk'}
            </button>
          </form>

          {/* Quick Demo Credentials (Local Mode) or First-Admin Notice */}
          {!hasUsers ? (
            <div className="mt-8 pt-6 border-t border-slate-200 space-y-3">
              <div>
                <p className="text-xs font-semibold text-red-600 mb-1">
                  Inisialisasi Administrator Pertama
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Database belum memiliki akun terdaftar. Pengguna pertama yang didaftarkan melalui
                  formulir di atas otomatis ditetapkan sebagai <strong>Admin</strong> di Supabase
                  Authentication.
                </p>
              </div>
              {backendMode === 'supabase-postgresql' && hasAdminKey && (
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2.5">
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Atau buat 3 akun awal otomatis (Admin, Guru, Tendik) ke Supabase dan langsung
                    masuk sebagai Administrator:
                  </p>
                  <button
                    type="button"
                    disabled={bootstrapping || submitting}
                    onClick={handleBootstrapDemo}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {bootstrapping
                        ? 'Membuat Akun di Supabase...'
                        : 'Buat 3 Akun Awal & Masuk (Admin)'}
                    </span>
                  </button>
                </div>
              )}
              {backendMode === 'supabase-postgresql' && !hasAdminKey && (
                <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/70 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-900">
                    Catatan Konfigurasi Secret Key Supabase
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Untuk membuat akun pertama sekarang, silakan daftar lewat formulir{' '}
                    <strong>Daftar Akun</strong> di atas memakai email aktif (mis. Gmail). Jika
                    ingin mengaktifkan fitur Admin User Management penuh &amp; tombol buat akun
                    otomatis, isi <code>SUPABASE_SERVICE_ROLE_KEY</code> di Secrets dengan{' '}
                    <strong>Secret key</strong> (<code>sb_secret_...</code> atau{' '}
                    <code>service_role</code>), bukan Publishable key.
                  </p>
                </div>
              )}
            </div>
          ) : backendMode === 'sqlite-relational' ? (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-500 mb-3">
                Akses Cepat Akun Pengujian per Role
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemo('admin@smkprimaunggul.sch.id', 'admin123')}
                  className="px-3 py-2 text-left border border-slate-200 rounded-lg hover:border-red-400 hover:bg-red-50/40 transition-colors"
                >
                  <span className="block text-xs font-bold text-red-600">Admin</span>
                  <span className="block text-[11px] text-slate-500 truncate">admin@smkprimaunggul</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('guru@smkprimaunggul.sch.id', 'guru123')}
                  className="px-3 py-2 text-left border border-slate-200 rounded-lg hover:border-red-400 hover:bg-red-50/40 transition-colors"
                >
                  <span className="block text-xs font-bold text-slate-900">Guru</span>
                  <span className="block text-[11px] text-slate-500 truncate">guru@smkprimaunggul</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('tendik@smkprimaunggul.sch.id', 'tendik123')}
                  className="px-3 py-2 text-left border border-slate-200 rounded-lg hover:border-red-400 hover:bg-red-50/40 transition-colors"
                >
                  <span className="block text-xs font-bold text-slate-900">Tendik</span>
                  <span className="block text-[11px] text-slate-500 truncate">tendik@smkprimaunggul</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <p className="text-xs text-slate-400 text-center lg:text-left">
          SMK Prima Unggul · Sistem Informasi Presensi Siswa &amp; Karyawan
        </p>
      </div>

      {/* Right Architectural Panel */}
      <div className="hidden lg:block lg:col-span-6 relative overflow-hidden bg-slate-900">
        <ResilientImage
          src="/src/assets/images/login_campus_hall_1795138189901.jpg"
          alt="Atrium dan koridor modern SMK Prima Unggul"
          className="w-full h-full object-cover"
          fallbackTitle="SMK Prima Unggul"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex flex-col justify-end p-12 text-white">
          <p className="text-xs font-semibold text-red-300 mb-2">
            Kedisiplinan Terukur · Data Real-Time
          </p>
          <h2 className="text-2xl font-bold leading-snug max-w-md mb-2">
            Satu platform untuk presensi karyawan, absensi kelas siswa, dan rekap kehadiran sekolah.
          </h2>
          <p className="text-sm text-slate-200 max-w-md">
            Seluruh catatan kehadiran tersinkronisasi aman sesuai hak akses Admin, Guru, dan Tenaga
            Kependidikan.
          </p>
        </div>
      </div>
    </div>
  );
}
