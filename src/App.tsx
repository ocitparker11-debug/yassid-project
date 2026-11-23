import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/app/DashboardPage';
import EmployeeAttendancePage from './pages/app/EmployeeAttendancePage';
import RecapEmployeePage from './pages/app/RecapEmployeePage';
import RecapStudentPage from './pages/app/RecapStudentPage';
import StudentAttendancePage from './pages/app/StudentAttendancePage';
import StudentsDataPage from './pages/app/StudentsDataPage';
import UserManagementPage from './pages/app/UserManagementPage';
import type { Role } from './types';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Memuat portal SMK Prima Unggul...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RoleGuard({ allowed, children }: { allowed: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !allowed.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="absensi-karyawan" element={<EmployeeAttendancePage />} />
            <Route
              path="absensi-siswa"
              element={
                <RoleGuard allowed={['admin', 'guru']}>
                  <StudentAttendancePage />
                </RoleGuard>
              }
            />
            <Route
              path="rekap-absensi/karyawan"
              element={
                <RoleGuard allowed={['admin']}>
                  <RecapEmployeePage />
                </RoleGuard>
              }
            />
            <Route
              path="rekap-absensi/siswa"
              element={
                <RoleGuard allowed={['admin', 'guru']}>
                  <RecapStudentPage />
                </RoleGuard>
              }
            />
            <Route
              path="data-siswa"
              element={
                <RoleGuard allowed={['admin']}>
                  <StudentsDataPage />
                </RoleGuard>
              }
            />
            <Route
              path="user-management"
              element={
                <RoleGuard allowed={['admin']}>
                  <UserManagementPage />
                </RoleGuard>
              }
            />
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
