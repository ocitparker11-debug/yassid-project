export type Role = 'admin' | 'guru' | 'tenaga_kependidikan';

export type MajorCode = 'TKJ' | 'DKV' | 'AK' | 'BC' | 'MPLB' | 'BD';

export type EmployeeAttendanceStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit';

export type StudentAttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alpha';

export interface UserProfile {
  id: string;
  nama: string;
  email: string;
  role: Role;
  nip: string;
  jabatan: string;
  createdAt: string;
}

export interface Student {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  jurusan: MajorCode;
  createdAt: string;
}

export interface EmployeeAttendance {
  id: string;
  userId: string;
  userName: string;
  userRole: Role;
  userNip: string;
  date: string; // YYYY-MM-DD
  checkInTime: string | null; // HH:mm:ss
  checkOutTime: string | null; // HH:mm:ss
  status: EmployeeAttendanceStatus;
  note: string;
  updatedAt: string;
}

export interface StudentAttendance {
  id: string;
  studentId: string;
  nis: string;
  studentName: string;
  kelas: string;
  jurusan: MajorCode;
  date: string; // YYYY-MM-DD
  status: StudentAttendanceStatus;
  note: string;
  recordedByUserId: string;
  recordedByName: string;
  updatedAt: string;
}

export interface DashboardData {
  today: string;
  myAttendanceToday: EmployeeAttendance | null;
  stats: {
    totalUsers: number;
    totalStudents: number;
    employeesPresentToday: number;
    totalEmployees: number;
    studentsPresentToday: number;
    studentsRecordedToday: number;
    myMonthlyPresent: number;
    myMonthlyTotal: number;
  };
  recentEmployeeAttendance: EmployeeAttendance[];
  recentStudentAttendance: StudentAttendance[];
}

export const MAJOR_LABELS: Record<MajorCode, string> = {
  TKJ: 'Teknik Komputer dan Jaringan',
  DKV: 'Desain Komunikasi Visual',
  AK: 'Akuntansi dan Keuangan Lembaga',
  BC: 'Broadcasting dan Perfilman',
  MPLB: 'Manajemen Perkantoran dan Layanan Bisnis',
  BD: 'Bisnis Digital',
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  guru: 'Guru',
  tenaga_kependidikan: 'Tenaga Kependidikan',
};
