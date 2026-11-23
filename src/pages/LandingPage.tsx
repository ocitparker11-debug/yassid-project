import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, ShieldCheck, Users } from 'lucide-react';
import { ResilientImage } from '../components/ResilientImage';
import { useAuth } from '../context/AuthContext';

type ClusterKey = 'all' | 'teknologi' | 'keuangan' | 'manajemen';

interface MajorItem {
  code: 'TKJ' | 'DKV' | 'BC' | 'AK' | 'MPLB' | 'BD';
  name: string;
  cluster: Exclude<ClusterKey, 'all'>;
  clusterLabel: string;
  summary: string;
  competencies: string;
}

const MAJORS: MajorItem[] = [
  {
    code: 'TKJ',
    name: 'Teknik Komputer dan Jaringan',
    cluster: 'teknologi',
    clusterLabel: 'Rumpun Teknologi & Media Kreatif',
    summary: 'Perancangan infrastruktur jaringan enterprise, administrasi server Linux, keamanan siber, dan fiber optik.',
    competencies: 'Mikrotik, Cisco CCNA, Cloud Server, Network Security',
  },
  {
    code: 'DKV',
    name: 'Desain Komunikasi Visual',
    cluster: 'teknologi',
    clusterLabel: 'Rumpun Teknologi & Media Kreatif',
    summary: 'Perancangan identitas merek, ilustrasi editorial, desain antarmuka digital, serta produksi grafis komersial.',
    competencies: 'Brand Identity, UI/UX Design, Fotografi, Motion Graphic',
  },
  {
    code: 'BC',
    name: 'Broadcasting dan Perfilman',
    cluster: 'teknologi',
    clusterLabel: 'Rumpun Teknologi & Media Kreatif',
    summary: 'Produksi siaran televisi sekolah, sinematografi, penyuntingan audio-video profesional, dan manajemen studio.',
    competencies: 'Sinematografi, Live Streaming, Tata Cahaya, Audio Mixing',
  },
  {
    code: 'AK',
    name: 'Akuntansi dan Keuangan Lembaga',
    cluster: 'keuangan',
    clusterLabel: 'Rumpun Keuangan & Akuntansi',
    summary: 'Penyusunan siklus laporan keuangan perusahaan jasa, dagang, perpajakan, serta audit berbasis perangkat lunak.',
    competencies: 'MYOB, Accurate, Perpajakan, Laporan Keuangan Standar PSAK',
  },
  {
    code: 'MPLB',
    name: 'Manajemen Perkantoran dan Layanan Bisnis',
    cluster: 'manajemen',
    clusterLabel: 'Rumpun Manajemen & Niaga Digital',
    summary: 'Tata kelola korespondensi eksekutif, kearsipan digital, protokol layanan prima, dan manajemen rapat korporasi.',
    competencies: 'Kearsipan Digital, Public Relations, Administrasi Eksekutif',
  },
  {
    code: 'BD',
    name: 'Bisnis Digital',
    cluster: 'manajemen',
    clusterLabel: 'Rumpun Manajemen & Niaga Digital',
    summary: 'Pengelolaan niaga elektronik, strategi pemasaran berbasis data analitik, konten niaga, dan kewirausahaan modern.',
    competencies: 'E-Commerce Operations, Digital Ads, Content Commerce, SEO',
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const [activeCluster, setActiveCluster] = useState<ClusterKey>('all');

  const visibleMajors =
    activeCluster === 'all' ? MAJORS : MAJORS.filter((m) => m.cluster === activeCluster);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2.5"
          >
            <span className="inline-block w-2.5 h-6 bg-red-600 rounded-xs" aria-hidden="true" />
            <span>SMK Prima Unggul</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#profil"
              className="hover:text-red-600 transition-colors whitespace-nowrap shrink-0"
            >
              Profil
            </a>
            <a
              href="#jurusan"
              className="hover:text-red-600 transition-colors whitespace-nowrap shrink-0"
            >
              Program Keahlian
            </a>
            <a
              href="#absensi"
              className="hover:text-red-600 transition-colors whitespace-nowrap shrink-0"
            >
              Sistem Absensi
            </a>
            <a
              href="#kontak"
              className="hover:text-red-600 transition-colors whitespace-nowrap shrink-0"
            >
              Kontak
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <Link
              to={user ? '/app/dashboard' : '/login'}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              {user ? 'Buka Aplikasi' : 'Masuk Portal'}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Split Section */}
        <section id="profil" className="border-b border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-between py-2">
                <div>
                  <p className="text-sm font-semibold text-red-600 mb-4">
                    Sekolah Menengah Kejuruan Terakreditasi A
                  </p>
                  <h1
                    className="font-extrabold tracking-tight text-slate-900 leading-[1.08] mb-6"
                    style={{ fontSize: 'clamp(2.25rem, 4vw, 3.65rem)', textWrap: 'balance' }}
                  >
                    Pendidikan Vokasi Disiplin dan Siap Kerja di SMK Prima Unggul
                  </h1>
                  <p className="text-base lg:text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
                    SMK Prima Unggul memadukan kurikulum berbasis industri pada 3 rumpun keahlian
                    utama dengan 6 kompetensi keahlian unggulan—didukung tata kelola presensi
                    digital terpadu bagi seluruh siswa, guru, dan tenaga kependidikan.
                  </p>
                  <div className="flex flex-wrap items-center gap-5">
                    <Link
                      to={user ? '/app/dashboard' : '/login'}
                      className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>{user ? 'Masuk ke Dashboard' : 'Masuk Sistem Absensi'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a
                      href="#jurusan"
                      className="text-sm font-semibold text-slate-700 hover:text-red-600 transition-colors whitespace-nowrap shrink-0 underline underline-offset-4 decoration-slate-300 hover:decoration-red-600"
                    >
                      Lihat 6 Kompetensi Keahlian
                    </a>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-10 pt-6 border-t border-slate-200">
                  NPSN 20108842 · Jl. Pendidikan Raya No. 88 · Tahun Ajaran 2026/2027
                </p>
              </div>

              <div className="lg:col-span-6">
                <div className="h-full min-h-[320px] lg:min-h-[440px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  <ResilientImage
                    src="/src/assets/images/hero_smk_campus_1795138189877.jpg"
                    alt="Gedung utama kampus SMK Prima Unggul"
                    className="w-full h-full object-cover"
                    fallbackTitle="Kampus Utama SMK Prima Unggul"
                  />
                </div>
              </div>
            </div>

            {/* Full-width 4-column proof strip below hero split */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-14 pt-10 border-t border-slate-200">
              <div>
                <p className="font-mono text-2xl lg:text-3xl font-bold text-slate-900 tabular-nums">
                  3 Rumpun
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  Bidang keahlian vokasi terstruktur
                </p>
              </div>
              <div>
                <p className="font-mono text-2xl lg:text-3xl font-bold text-red-600 tabular-nums">
                  6 Jurusan
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  TKJ, DKV, AK, BC, MPLB, dan BD
                </p>
              </div>
              <div>
                <p className="font-mono text-2xl lg:text-3xl font-bold text-slate-900 tabular-nums">
                  96.4%
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  Tingkat serapan industri &amp; studi lanjut
                </p>
              </div>
              <div>
                <p className="font-mono text-2xl lg:text-3xl font-bold text-slate-900 tabular-nums">
                  3 Peran
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  Portal terpadu Admin, Guru &amp; Tendik
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3 Rumpun & 6 Jurusan Section */}
        <section id="jurusan" className="py-20 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold text-red-600 mb-2">
                  Program Keahlian Unggulan
                </p>
                <h2
                  className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900"
                  style={{ textWrap: 'balance' }}
                >
                  Tiga Rumpun Program dengan Enam Kompetensi Keahlian
                </h2>
                <p className="text-slate-600 mt-3 leading-relaxed">
                  Setiap jurusan dirancang bersama mitra dunia usaha dan dunia industri untuk
                  membentuk lulusan yang terampil, beretika, dan siap bersaing.
                </p>
              </div>

              {/* Interactive Filter Controls */}
              <div
                className="inline-flex flex-wrap items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg shrink-0"
                role="tablist"
                aria-label="Filter rumpun keahlian"
              >
                <button
                  type="button"
                  onClick={() => setActiveCluster('all')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeCluster === 'all'
                      ? 'bg-red-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua Jurusan (6)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCluster('teknologi')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeCluster === 'teknologi'
                      ? 'bg-red-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Teknologi &amp; Media
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCluster('keuangan')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeCluster === 'keuangan'
                      ? 'bg-red-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Keuangan
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCluster('manajemen')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeCluster === 'manajemen'
                      ? 'bg-red-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Manajemen &amp; Niaga
                </button>
              </div>
            </div>

            {/* Majors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleMajors.map((major, idx) => (
                <article
                  key={major.code}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-red-300 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                      <span className="font-mono font-semibold text-red-600">
                        {String(idx + 1).padStart(2, '0')}. {major.code}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[210px]">{major.clusterLabel}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug">
                      {major.name}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed mb-5">
                      {major.summary}
                    </p>
                  </div>

                  <p className="text-xs text-slate-500 pt-4 border-t border-slate-100">
                    Fokus: {major.competencies}
                  </p>
                </article>
              ))}
            </div>

            {/* Lab & Studio Proof Photography Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 sm:grid-cols-2 items-stretch">
                <div className="min-h-[200px] bg-slate-100">
                  <ResilientImage
                    src="/src/assets/images/lab_tkj_dkv_1795138190343.jpg"
                    alt="Laboratorium komputer TKJ dan DKV SMK Prima Unggul"
                    className="w-full h-full object-cover"
                    fallbackTitle="Laboratorium TKJ & DKV"
                  />
                </div>
                <div className="p-6 flex flex-col justify-center">
                  <p className="text-xs font-semibold text-red-600 mb-1.5">
                    Fasilitas Praktik Industri
                  </p>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    Laboratorium TKJ &amp; Studio Desain DKV
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Dilengkapi perangkat kerja standar industri, rak jaringan terkelola, serta
                    workstation grafis berkalibrasi warna.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 sm:grid-cols-2 items-stretch">
                <div className="min-h-[200px] bg-slate-100">
                  <ResilientImage
                    src="/src/assets/images/studio_broadcasting_1795138189863.jpg"
                    alt="Studio broadcasting dan bisnis digital SMK Prima Unggul"
                    className="w-full h-full object-cover"
                    fallbackTitle="Studio Broadcasting & Bisnis Digital"
                  />
                </div>
                <div className="p-6 flex flex-col justify-center">
                  <p className="text-xs font-semibold text-red-600 mb-1.5">
                    Unit Produksi Sekolah
                  </p>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    Studio Broadcasting &amp; Lab Niaga Digital
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Ruang siaran multi-kamera, kendali audio digital, serta inkubator transaksi
                    bisnis dan akuntansi terkomputerisasi.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Integrated Attendance Workflow Overview */}
        <section id="absensi" className="py-20 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <p className="text-sm font-semibold text-red-600 mb-2">
                Tata Kelola Digital Sekolah
              </p>
              <h2
                className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900"
                style={{ textWrap: 'balance' }}
              >
                Sistem Absensi Siswa dan Karyawan dalam Satu Portal
              </h2>
              <p className="text-slate-600 mt-3 leading-relaxed">
                Dirancang dengan pembagian hak akses yang tegas agar pencatatan kehadiran harian
                berlangsung akurat, transparan, dan mudah direkapitulasi.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="border border-slate-200 rounded-xl p-7 bg-white">
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  01. Administrator Sekolah
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Mengelola seluruh pengguna (Admin, Guru, Tenaga Kependidikan), memperbarui master
                  data siswa seluruh jurusan, serta memantau rekap absensi karyawan dan siswa.
                </p>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Manajemen akun &amp; sinkronisasi autentikasi</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Kelola master data NIS, nama, &amp; kelas siswa</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Rekap absensi karyawan &amp; siswa lintas kelas</span>
                  </li>
                </ul>
              </div>

              <div className="border border-slate-200 rounded-xl p-7 bg-white">
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-5">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  02. Guru Mata Pelajaran &amp; Wali Kelas
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Melakukan absen kehadiran pribadi sebagai karyawan sekolah, mencatat presensi
                  siswa per kelas secara cepat, dan meninjau rekap kehadiran siswa.
                </p>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Absen masuk dan pulang mandiri harian</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Pencatatan status Hadir, Sakit, Izin, Alpha siswa</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Ekspor laporan rekap absensi siswa ke CSV</span>
                  </li>
                </ul>
              </div>

              <div className="border border-slate-200 rounded-xl p-7 bg-white">
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-5">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  03. Tenaga Kependidikan
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Mengakses ringkasan kehadiran bulanan pribadi pada dashboard serta melakukan
                  pencatatan absensi karyawan secara mandiri setiap hari kerja.
                </p>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Pencatatan waktu masuk &amp; pulang real-time</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Pengajuan keterangan Izin atau Sakit harian</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Riwayat kehadiran pribadi yang rapi dan terarsip</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-12 p-8 rounded-xl bg-slate-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-red-400 text-sm font-semibold mb-1.5">
                  <ClipboardCheck className="w-4 h-4" />
                  <span>Akses Portal Terpadu</span>
                </div>
                <h3 className="text-2xl font-bold tracking-tight">
                  Siap mencatat kehadiran hari ini?
                </h3>
                <p className="text-slate-300 text-sm mt-1">
                  Masuk menggunakan akun Admin, Guru, atau Tenaga Kependidikan SMK Prima Unggul.
                </p>
              </div>
              <Link
                to={user ? '/app/dashboard' : '/login'}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap shrink-0"
              >
                <span>{user ? 'Ke Dashboard Aplikasi' : 'Masuk ke Portal'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer id="kontak" className="bg-slate-50 text-slate-600 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-base font-bold text-slate-900">SMK Prima Unggul</p>
            <p className="text-sm text-slate-500 mt-1">
              Jl. Pendidikan Raya No. 88 · Telp (021) 555-0188 · info@smkprimaunggul.sch.id
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a href="#profil" className="hover:text-red-600 transition-colors whitespace-nowrap">
              Profil Sekolah
            </a>
            <a href="#jurusan" className="hover:text-red-600 transition-colors whitespace-nowrap">
              Kompetensi Keahlian
            </a>
            <Link to="/login" className="font-semibold text-red-600 hover:text-red-700 whitespace-nowrap">
              Login Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
