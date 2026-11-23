import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCheck,
  UserCog,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../types';

function getPageTitle(pathname: string): string {
  if (pathname.includes('/app/absensi-karyawan')) return 'Absensi Karyawan';
  if (pathname.includes('/app/absensi-siswa')) return 'Absensi Siswa';
  if (pathname.includes('/app/rekap-absensi/karyawan')) return 'Rekap Absensi Karyawan';
  if (pathname.includes('/app/rekap-absensi/siswa')) return 'Rekap Absensi Siswa';
  if (pathname.includes('/app/data-siswa')) return 'Data Siswa';
  if (pathname.includes('/app/user-management')) return 'User Management';
  return 'Dashboard';
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rekapOpen, setRekapOpen] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isGuru = user.role === 'guru';
  const showAbsensiSiswa = isAdmin || isGuru;
  const showRekapMenu = isAdmin || isGuru;

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login', { replace: true });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-red-600 text-white'
        : 'text-slate-700 hover:bg-red-50/70 hover:text-red-700'
    }`;

  const subLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 pl-10 pr-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
      isActive
        ? 'text-red-600 bg-red-50 font-semibold'
        : 'text-slate-600 hover:text-red-700 hover:bg-slate-50'
    }`;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Brand Mark */}
      <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between shrink-0">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-slate-900 whitespace-nowrap"
        >
          <span className="inline-block w-2.5 h-5 bg-red-600 rounded-xs" aria-hidden="true" />
          <span>SMK Prima Unggul</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          aria-label="Tutup menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1.5" aria-label="Menu Aplikasi">
        <NavLink
          to="/app/dashboard"
          className={navLinkClass}
          onClick={() => setMobileMenuOpen(false)}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/app/absensi-karyawan"
          className={navLinkClass}
          onClick={() => setMobileMenuOpen(false)}
        >
          <UserCheck className="w-4 h-4 shrink-0" />
          <span>Absensi Karyawan</span>
        </NavLink>

        {showAbsensiSiswa && (
          <NavLink
            to="/app/absensi-siswa"
            className={navLinkClass}
            onClick={() => setMobileMenuOpen(false)}
          >
            <ClipboardCheck className="w-4 h-4 shrink-0" />
            <span>Absensi Siswa</span>
          </NavLink>
        )}

        {showRekapMenu && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setRekapOpen((prev) => !prev)}
              className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                location.pathname.includes('/app/rekap-absensi')
                  ? 'text-red-700 bg-red-50/70'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
              aria-expanded={rekapOpen}
            >
              <span className="flex items-center gap-3">
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>Rekap Absensi</span>
              </span>
              {rekapOpen ? (
                <ChevronDown className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 shrink-0" />
              )}
            </button>

            {rekapOpen && (
              <div className="mt-1 space-y-1">
                {isAdmin && (
                  <NavLink
                    to="/app/rekap-absensi/karyawan"
                    className={subLinkClass}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Absensi Karyawan</span>
                  </NavLink>
                )}
                {(isAdmin || isGuru) && (
                  <NavLink
                    to="/app/rekap-absensi/siswa"
                    className={subLinkClass}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Absensi Siswa</span>
                  </NavLink>
                )}
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <>
            <NavLink
              to="/app/data-siswa"
              className={navLinkClass}
              onClick={() => setMobileMenuOpen(false)}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>Data Siswa</span>
            </NavLink>

            <NavLink
              to="/app/user-management"
              className={navLinkClass}
              onClick={() => setMobileMenuOpen(false)}
            >
              <UserCog className="w-4 h-4 shrink-0" />
              <span>User Management</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Bottom Account Summary */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70">
        <p className="text-xs font-bold text-slate-900 truncate">{user.nama}</p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {ROLE_LABELS[user.role]} · {user.jabatan}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar with Breadcrumb on Left and Logout Button on Top Right */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400 font-medium whitespace-nowrap">
                Portal
              </span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">
                /
              </span>
              <h1 className="font-bold text-slate-900 truncate">{getPageTitle(location.pathname)}</h1>
            </div>
          </div>

          <div className="flex items-center gap-5 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-900 max-w-[180px] truncate">{user.nama}</span>
              <span aria-hidden="true">·</span>
              <span className="text-red-600 font-semibold">{ROLE_LABELS[user.role]}</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 hover:border-red-600 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>{loggingOut ? 'Keluar...' : 'Logout'}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
