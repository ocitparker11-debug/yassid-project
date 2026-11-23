import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  DashboardData,
  EmployeeAttendance,
  EmployeeAttendanceStatus,
  MajorCode,
  Role,
  Student,
  StudentAttendance,
  StudentAttendanceStatus,
  UserProfile,
} from '../types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SQLITE_FILE = path.join(DATA_DIR, 'smk_prima_unggul.db');
const LEGACY_JSON_FILE = path.join(DATA_DIR, 'attendance-db.json');

let dbInstance: DatabaseSync | null = null;

export function hashPassword(
  password: string,
  existingSalt?: string
): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computed = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function getTodayJakartaDate(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function getCurrentJakartaTime(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
}

function getPastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function cleanOrphanedWalFiles(): void {
  const walFile = `${SQLITE_FILE}-wal`;
  const shmFile = `${SQLITE_FILE}-shm`;
  const mainExists = fs.existsSync(SQLITE_FILE);
  const mainSize = mainExists ? fs.statSync(SQLITE_FILE).size : 0;

  // If main DB is missing or 0 bytes while orphaned WAL/SHM exist, remove stale WAL/SHM
  if ((!mainExists || mainSize === 0) && (fs.existsSync(walFile) || fs.existsSync(shmFile))) {
    try {
      if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
      if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
    } catch {
      // ignore cleanup failures
    }
  }
}

function initializeRelationalSchema(db: DatabaseSync): void {
  // Use single-file DELETE journal mode so all data commits atomically into smk_prima_unggul.db
  db.exec(`
    PRAGMA journal_mode = DELETE;
    PRAGMA synchronous = FULL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS majors (
      code TEXT PRIMARY KEY CHECK (code IN ('TKJ', 'DKV', 'AK', 'BC', 'MPLB', 'BD')),
      name TEXT NOT NULL,
      cluster TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nama TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      role TEXT NOT NULL CHECK (role IN ('admin', 'guru', 'tenaga_kependidikan')),
      nip TEXT NOT NULL DEFAULT '-',
      jabatan TEXT NOT NULL DEFAULT 'Karyawan Sekolah',
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      nis TEXT NOT NULL UNIQUE COLLATE NOCASE,
      nama TEXT NOT NULL,
      kelas TEXT NOT NULL,
      jurusan TEXT NOT NULL REFERENCES majors(code) ON UPDATE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_students_jurusan_kelas ON students(jurusan, kelas);

    CREATE TABLE IF NOT EXISTS employee_attendance (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      check_in_time TEXT,
      check_out_time TEXT,
      status TEXT NOT NULL CHECK (status IN ('Hadir', 'Terlambat', 'Izin', 'Sakit')),
      note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_emp_att_date ON employee_attendance(date DESC);
    CREATE INDEX IF NOT EXISTS idx_emp_att_user ON employee_attendance(user_id);

    CREATE TABLE IF NOT EXISTS student_attendance (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Hadir', 'Sakit', 'Izin', 'Alpha')),
      note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      UNIQUE(student_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_std_att_date ON student_attendance(date DESC);
    CREATE INDEX IF NOT EXISTS idx_std_att_student ON student_attendance(student_id);
    CREATE INDEX IF NOT EXISTS idx_std_att_recorder ON student_attendance(recorded_by);
  `);

  const insertMajor = db.prepare(`
    INSERT OR IGNORE INTO majors (code, name, cluster) VALUES (?, ?, ?)
  `);
  const majorsSeed: Array<[MajorCode, string, string]> = [
    ['TKJ', 'Teknik Komputer dan Jaringan', 'Teknologi Informasi & Media Kreatif'],
    ['DKV', 'Desain Komunikasi Visual', 'Teknologi Informasi & Media Kreatif'],
    ['BC', 'Broadcasting dan Perfilman', 'Teknologi Informasi & Media Kreatif'],
    ['AK', 'Akuntansi dan Keuangan Lembaga', 'Keuangan & Akuntansi'],
    ['MPLB', 'Manajemen Perkantoran dan Layanan Bisnis', 'Manajemen & Niaga Digital'],
    ['BD', 'Bisnis Digital', 'Manajemen & Niaga Digital'],
  ];
  for (const [code, name, cluster] of majorsSeed) {
    insertMajor.run(code, name, cluster);
  }

  db.prepare(`
    INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
    VALUES (?, ?, ?)
  `).run(2, 'relational_majors_and_delete_journal', new Date().toISOString());
}

function seedOrMigrateDatabase(db: DatabaseSync): void {
  const userCountRow = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
  const studentCountRow = db.prepare('SELECT COUNT(*) AS count FROM students').get() as {
    count: number;
  };

  if (userCountRow.count > 0 || studentCountRow.count > 0) {
    return;
  }

  if (fs.existsSync(LEGACY_JSON_FILE)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_JSON_FILE, 'utf8'));
      const insertUser = db.prepare(`
        INSERT OR IGNORE INTO users (id, nama, email, role, nip, jabatan, password_hash, password_salt, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertSession = db.prepare(`
        INSERT OR IGNORE INTO sessions (token, user_id, created_at)
        VALUES (?, ?, ?)
      `);
      const insertStudent = db.prepare(`
        INSERT OR IGNORE INTO students (id, nis, nama, kelas, jurusan, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const insertEmpAtt = db.prepare(`
        INSERT OR IGNORE INTO employee_attendance (id, user_id, date, check_in_time, check_out_time, status, note, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertStdAtt = db.prepare(`
        INSERT OR IGNORE INTO student_attendance (id, student_id, recorded_by, date, status, note, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      db.exec('BEGIN');
      try {
        for (const u of legacy.users || []) {
          insertUser.run(
            u.id,
            u.nama,
            u.email,
            u.role,
            u.nip || '-',
            u.jabatan || 'Karyawan Sekolah',
            u.passwordHash,
            u.passwordSalt,
            u.createdAt || new Date().toISOString()
          );
        }
        for (const s of legacy.sessions || []) {
          insertSession.run(s.token, s.userId, s.createdAt || new Date().toISOString());
        }
        for (const st of legacy.students || []) {
          insertStudent.run(
            st.id,
            st.nis,
            st.nama,
            st.kelas,
            st.jurusan,
            st.createdAt || new Date().toISOString()
          );
        }
        for (const ea of legacy.employeeAttendance || []) {
          insertEmpAtt.run(
            ea.id,
            ea.userId,
            ea.date,
            ea.checkInTime || null,
            ea.checkOutTime || null,
            ea.status,
            ea.note || '',
            ea.updatedAt || new Date().toISOString()
          );
        }
        for (const sa of legacy.studentAttendance || []) {
          insertStdAtt.run(
            sa.id,
            sa.studentId,
            sa.recordedByUserId || null,
            sa.date,
            sa.status,
            sa.note || '',
            sa.updatedAt || new Date().toISOString()
          );
        }
        db.exec('COMMIT');
        return;
      } catch (err) {
        db.exec('ROLLBACK');
        console.error('Legacy migration error, falling back to clean seed:', err);
      }
    } catch {
      // ignore invalid legacy JSON
    }
  }

  const nowIso = new Date().toISOString();
  const adminCreds = hashPassword('admin123');
  const guru1Creds = hashPassword('guru123');
  const guru2Creds = hashPassword('guru123');
  const tendik1Creds = hashPassword('tendik123');
  const tendik2Creds = hashPassword('tendik123');

  const seedUsers = [
    {
      id: 'usr_admin_01',
      nama: 'Drs. Hendra Wijaya, M.Pd.',
      email: 'admin@smkprimaunggul.sch.id',
      role: 'admin' as Role,
      nip: '197804122005011004',
      jabatan: 'Kepala Tata Usaha & Administrator',
      creds: adminCreds,
    },
    {
      id: 'usr_guru_01',
      nama: 'Siti Nurhaliza, S.Kom.',
      email: 'guru@smkprimaunggul.sch.id',
      role: 'guru' as Role,
      nip: '198906152014022003',
      jabatan: 'Guru Produktif TKJ',
      creds: guru1Creds,
    },
    {
      id: 'usr_guru_02',
      nama: 'Rizky Ramadhan, S.Ds.',
      email: 'rizky.dkv@smkprimaunggul.sch.id',
      role: 'guru' as Role,
      nip: '199203212019031007',
      jabatan: 'Guru Produktif DKV & Broadcasting',
      creds: guru2Creds,
    },
    {
      id: 'usr_tendik_01',
      nama: 'Budi Santoso',
      email: 'tendik@smkprimaunggul.sch.id',
      role: 'tenaga_kependidikan' as Role,
      nip: '199508092020121002',
      jabatan: 'Staf Administrasi Akademik',
      creds: tendik1Creds,
    },
    {
      id: 'usr_tendik_02',
      nama: 'Dewi Lestari, A.Md.',
      email: 'dewi.tu@smkprimaunggul.sch.id',
      role: 'tenaga_kependidikan' as Role,
      nip: '199711142022012009',
      jabatan: 'Petugas Perpustakaan & Arsip',
      creds: tendik2Creds,
    },
  ];

  const seedStudents: Array<{ id: string; nis: string; nama: string; kelas: string; jurusan: MajorCode }> = [
    { id: 'std_001', nis: '20241001', nama: 'Ahmad Fauzan Pratama', kelas: 'X TKJ 1', jurusan: 'TKJ' },
    { id: 'std_002', nis: '20241002', nama: 'Nadia Putri Azzahra', kelas: 'X TKJ 1', jurusan: 'TKJ' },
    { id: 'std_003', nis: '20241003', nama: 'Dimas Arya Saputra', kelas: 'XI TKJ 1', jurusan: 'TKJ' },
    { id: 'std_004', nis: '20241004', nama: 'Rania Khairunnisa', kelas: 'XII TKJ 1', jurusan: 'TKJ' },
    { id: 'std_005', nis: '20242001', nama: 'Bagas Prakoso Wibowo', kelas: 'X DKV 1', jurusan: 'DKV' },
    { id: 'std_006', nis: '20242002', nama: 'Aulia Rahmawati', kelas: 'XI DKV 1', jurusan: 'DKV' },
    { id: 'std_007', nis: '20242003', nama: 'Keisha Maharani Putri', kelas: 'XI DKV 1', jurusan: 'DKV' },
    { id: 'std_008', nis: '20242004', nama: 'Fajar Nugroho', kelas: 'XII DKV 1', jurusan: 'DKV' },
    { id: 'std_009', nis: '20243001', nama: 'Salsa Bila Oktaviani', kelas: 'X AK 1', jurusan: 'AK' },
    { id: 'std_010', nis: '20243002', nama: 'Muhammad Ilham Akbar', kelas: 'XI AK 1', jurusan: 'AK' },
    { id: 'std_011', nis: '20243003', nama: 'Tiara Puspitasari', kelas: 'XII AK 1', jurusan: 'AK' },
    { id: 'std_012', nis: '20243004', nama: 'Naufal Hakim Siregar', kelas: 'XII AK 1', jurusan: 'AK' },
    { id: 'std_013', nis: '20244001', nama: 'Clarissa Amanda Wijaya', kelas: 'X BC 1', jurusan: 'BC' },
    { id: 'std_014', nis: '20244002', nama: 'Galih Permana Putra', kelas: 'XI BC 1', jurusan: 'BC' },
    { id: 'std_015', nis: '20244003', nama: 'Zahra Aliyah Putri', kelas: 'XII BC 1', jurusan: 'BC' },
    { id: 'std_016', nis: '20245001', nama: 'Intan Permata Sari', kelas: 'X MPLB 1', jurusan: 'MPLB' },
    { id: 'std_017', nis: '20245002', nama: 'Dinda Ayu Kusuma', kelas: 'XI MPLB 1', jurusan: 'MPLB' },
    { id: 'std_018', nis: '20245003', nama: 'Reza Pahlevi Mahendra', kelas: 'XII MPLB 1', jurusan: 'MPLB' },
    { id: 'std_019', nis: '20246001', nama: 'Arif Budiman Santoso', kelas: 'X BD 1', jurusan: 'BD' },
    { id: 'std_020', nis: '20246002', nama: 'Maya Anggraini', kelas: 'XI BD 1', jurusan: 'BD' },
    { id: 'std_021', nis: '20246003', nama: 'Kevin Alexander Tan', kelas: 'XII BD 1', jurusan: 'BD' },
  ];

  db.exec('BEGIN');
  try {
    const insertUser = db.prepare(`
      INSERT INTO users (id, nama, email, role, nip, jabatan, password_hash, password_salt, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const u of seedUsers) {
      insertUser.run(
        u.id,
        u.nama,
        u.email,
        u.role,
        u.nip,
        u.jabatan,
        u.creds.hash,
        u.creds.salt,
        nowIso
      );
    }

    const insertStudent = db.prepare(`
      INSERT INTO students (id, nis, nama, kelas, jurusan, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const st of seedStudents) {
      insertStudent.run(st.id, st.nis, st.nama, st.kelas, st.jurusan, nowIso);
    }

    const insertEmpAtt = db.prepare(`
      INSERT INTO employee_attendance (id, user_id, date, check_in_time, check_out_time, status, note, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const pastDates = [getPastDate(3), getPastDate(2), getPastDate(1)];
    pastDates.forEach((date, dayIdx) => {
      seedUsers.forEach((u, userIdx) => {
        let status: EmployeeAttendanceStatus = 'Hadir';
        let checkInTime: string | null = `06:5${(userIdx + dayIdx) % 8}:12`;
        let checkOutTime: string | null = `15:3${(userIdx + 2) % 9}:04`;
        let note = 'Tugas harian berjalan normal';

        if (dayIdx === 1 && userIdx === 3) {
          status = 'Terlambat';
          checkInTime = '07:24:18';
          note = 'Kendala lalu lintas pagi';
        } else if (dayIdx === 2 && userIdx === 4) {
          status = 'Izin';
          checkInTime = null;
          checkOutTime = null;
          note = 'Izin urusan keluarga';
        }

        insertEmpAtt.run(
          `emp_att_${date}_${u.id}`,
          u.id,
          date,
          checkInTime,
          checkOutTime,
          status,
          note,
          nowIso
        );
      });
    });

    const insertStdAtt = db.prepare(`
      INSERT INTO student_attendance (id, student_id, recorded_by, date, status, note, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    [getPastDate(2), getPastDate(1)].forEach((date, dayIdx) => {
      seedStudents.forEach((std, sIdx) => {
        let status: StudentAttendanceStatus = 'Hadir';
        let note = '';
        if (dayIdx === 0 && sIdx === 5) {
          status = 'Sakit';
          note = 'Surat keterangan orang tua';
        } else if (dayIdx === 1 && sIdx === 9) {
          status = 'Izin';
          note = 'Lomba kompetensi siswa tingkat kota';
        } else if (dayIdx === 1 && sIdx === 17) {
          status = 'Alpha';
          note = 'Belum ada konfirmasi wali murid';
        }

        insertStdAtt.run(
          `std_att_${date}_${std.id}`,
          std.id,
          'usr_guru_01',
          date,
          status,
          note,
          nowIso
        );
      });
    });

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getSqliteDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  cleanOrphanedWalFiles();
  const db = new DatabaseSync(SQLITE_FILE);
  initializeRelationalSchema(db);
  seedOrMigrateDatabase(db);
  dbInstance = db;
  return dbInstance;
}

interface UserRow {
  id: string;
  nama: string;
  email: string;
  role: Role;
  nip: string;
  jabatan: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
}

function mapUserRow(row: Omit<UserRow, 'password_hash' | 'password_salt'>): UserProfile {
  return {
    id: row.id,
    nama: row.nama,
    email: row.email,
    role: row.role,
    nip: row.nip,
    jabatan: row.jabatan,
    createdAt: row.created_at,
  };
}

interface StudentRow {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  jurusan: MajorCode;
  created_at: string;
}

function mapStudentRow(row: StudentRow): Student {
  return {
    id: row.id,
    nis: row.nis,
    nama: row.nama,
    kelas: row.kelas,
    jurusan: row.jurusan,
    createdAt: row.created_at,
  };
}

interface EmpAttJoinRow {
  id: string;
  user_id: string;
  user_name: string;
  user_role: Role;
  user_nip: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: EmployeeAttendanceStatus;
  note: string;
  updated_at: string;
}

function mapEmpAttRow(row: EmpAttJoinRow): EmployeeAttendance {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    userNip: row.user_nip,
    date: row.date,
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    status: row.status,
    note: row.note,
    updatedAt: row.updated_at,
  };
}

interface StdAttJoinRow {
  id: string;
  student_id: string;
  nis: string;
  student_name: string;
  kelas: string;
  jurusan: MajorCode;
  date: string;
  status: StudentAttendanceStatus;
  note: string;
  recorded_by: string | null;
  recorded_by_name: string | null;
  updated_at: string;
}

function mapStdAttRow(row: StdAttJoinRow): StudentAttendance {
  return {
    id: row.id,
    studentId: row.student_id,
    nis: row.nis,
    studentName: row.student_name,
    kelas: row.kelas,
    jurusan: row.jurusan,
    date: row.date,
    status: row.status,
    note: row.note,
    recordedByUserId: row.recorded_by || '',
    recordedByName: row.recorded_by_name || 'Guru/Admin',
    updatedAt: row.updated_at,
  };
}

export function getAuthStatusLocal(): { hasUsers: boolean; userCount: number } {
  const db = getSqliteDb();
  const row = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
  return { hasUsers: row.count > 0, userCount: row.count };
}

export function verifyTokenLocal(token: string): UserProfile | null {
  const db = getSqliteDb();
  const row = db
    .prepare(
      `SELECT u.id, u.nama, u.email, u.role, u.nip, u.jabatan, u.created_at
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as Omit<UserRow, 'password_hash' | 'password_salt'> | undefined;

  return row ? mapUserRow(row) : null;
}

export function loginLocal(
  email: string,
  password: string
): { token: string; user: UserProfile } | null {
  const db = getSqliteDb();
  const row = db
    .prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)')
    .get(email) as UserRow | undefined;

  if (!row || !verifyPassword(password, row.password_hash, row.password_salt)) {
    return null;
  }

  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(
    token,
    row.id,
    new Date().toISOString()
  );

  return { token, user: mapUserRow(row) };
}

export function registerLocal(input: {
  nama: string;
  email: string;
  password: string;
  nip: string;
  jabatan: string;
  role: Exclude<Role, 'admin'>;
}): { token: string; user: UserProfile } {
  const db = getSqliteDb();
  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
    .get(input.email);
  if (existing) {
    throw new Error('Email sudah terdaftar di sistem.');
  }

  const countRow = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
  const isFirstUser = countRow.count === 0;
  const assignedRole: Role = isFirstUser
    ? 'admin'
    : input.role === 'guru'
      ? 'guru'
      : 'tenaga_kependidikan';

  const { hash, salt } = hashPassword(input.password);
  const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
  const nowIso = new Date().toISOString();
  const jabatan =
    input.jabatan ||
    (assignedRole === 'admin'
      ? 'Administrator Sistem'
      : assignedRole === 'guru'
        ? 'Guru Mata Pelajaran'
        : 'Tenaga Kependidikan');

  const token = crypto.randomBytes(32).toString('hex');

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO users (id, nama, email, role, nip, jabatan, password_hash, password_salt, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.nama, input.email, assignedRole, input.nip || '-', jabatan, hash, salt, nowIso);

    db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(
      token,
      id,
      nowIso
    );
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return {
    token,
    user: {
      id,
      nama: input.nama,
      email: input.email,
      role: assignedRole,
      nip: input.nip || '-',
      jabatan,
      createdAt: nowIso,
    },
  };
}

export function logoutLocal(token: string): void {
  const db = getSqliteDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function getDashboardLocal(user: UserProfile): DashboardData {
  const db = getSqliteDb();
  const today = getTodayJakartaDate();
  const monthPrefix = `${today.slice(0, 7)}%`;

  const totalUsers = (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number })
    .count;
  const totalStudents = (
    db.prepare('SELECT COUNT(*) AS count FROM students').get() as { count: number }
  ).count;

  const myTodayRow = db
    .prepare(
      `SELECT ea.*, u.nama AS user_name, u.role AS user_role, u.nip AS user_nip
       FROM employee_attendance ea
       INNER JOIN users u ON u.id = ea.user_id
       WHERE ea.user_id = ? AND ea.date = ?`
    )
    .get(user.id, today) as EmpAttJoinRow | undefined;

  const myMonthlyRow = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status IN ('Hadir', 'Terlambat') THEN 1 ELSE 0 END) AS present
       FROM employee_attendance
       WHERE user_id = ? AND date LIKE ?`
    )
    .get(user.id, monthPrefix) as { total: number; present: number | null };

  const empTodayRow = db
    .prepare(
      `SELECT SUM(CASE WHEN status IN ('Hadir', 'Terlambat') THEN 1 ELSE 0 END) AS present
       FROM employee_attendance
       WHERE date = ?`
    )
    .get(today) as { present: number | null };

  const stdTodayRow = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) AS present
       FROM student_attendance
       WHERE date = ?`
    )
    .get(today) as { total: number; present: number | null };

  const recentEmpRows = (
    user.role === 'admin'
      ? db
          .prepare(
            `SELECT ea.*, u.nama AS user_name, u.role AS user_role, u.nip AS user_nip
             FROM employee_attendance ea
             INNER JOIN users u ON u.id = ea.user_id
             ORDER BY ea.date DESC, COALESCE(ea.check_in_time, '') DESC
             LIMIT 8`
          )
          .all()
      : db
          .prepare(
            `SELECT ea.*, u.nama AS user_name, u.role AS user_role, u.nip AS user_nip
             FROM employee_attendance ea
             INNER JOIN users u ON u.id = ea.user_id
             WHERE ea.user_id = ?
             ORDER BY ea.date DESC, COALESCE(ea.check_in_time, '') DESC
             LIMIT 8`
          )
          .all(user.id)
  ) as unknown as EmpAttJoinRow[];

  const recentStdRows =
    user.role === 'tenaga_kependidikan'
      ? []
      : (db
          .prepare(
            `SELECT sa.*, s.nis, s.nama AS student_name, s.kelas, s.jurusan, rec.nama AS recorded_by_name
             FROM student_attendance sa
             INNER JOIN students s ON s.id = sa.student_id
             LEFT JOIN users rec ON rec.id = sa.recorded_by
             ORDER BY sa.updated_at DESC
             LIMIT 8`
          )
          .all() as unknown as StdAttJoinRow[]);

  return {
    today,
    myAttendanceToday: myTodayRow ? mapEmpAttRow(myTodayRow) : null,
    stats: {
      totalUsers,
      totalStudents,
      employeesPresentToday: empTodayRow.present || 0,
      totalEmployees: totalUsers,
      studentsPresentToday: stdTodayRow.present || 0,
      studentsRecordedToday: stdTodayRow.total || 0,
      myMonthlyPresent: myMonthlyRow.present || 0,
      myMonthlyTotal: myMonthlyRow.total || 0,
    },
    recentEmployeeAttendance: recentEmpRows.map(mapEmpAttRow),
    recentStudentAttendance: recentStdRows.map(mapStdAttRow),
  };
}

export function getEmployeeAttendanceLocal(
  user: UserProfile,
  filters: {
    startDate?: string;
    endDate?: string;
    status?: string;
    role?: string;
    search?: string;
    scope?: string;
  }
): { records: EmployeeAttendance[]; today: string } {
  const db = getSqliteDb();
  const clauses: string[] = [];
  const params: Array<string> = [];

  if (user.role !== 'admin' || filters.scope === 'self') {
    clauses.push('ea.user_id = ?');
    params.push(user.id);
  }
  if (filters.startDate) {
    clauses.push('ea.date >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    clauses.push('ea.date <= ?');
    params.push(filters.endDate);
  }
  if (filters.status && filters.status !== 'ALL') {
    clauses.push('ea.status = ?');
    params.push(filters.status);
  }
  if (filters.role && filters.role !== 'ALL') {
    clauses.push('u.role = ?');
    params.push(filters.role);
  }
  if (filters.search) {
    clauses.push('(LOWER(u.nama) LIKE ? OR LOWER(u.nip) LIKE ? OR LOWER(ea.note) LIKE ?)');
    const pattern = `%${filters.search.toLowerCase()}%`;
    params.push(pattern, pattern, pattern);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT ea.*, u.nama AS user_name, u.role AS user_role, u.nip AS user_nip
       FROM employee_attendance ea
       INNER JOIN users u ON u.id = ea.user_id
       ${whereSql}
       ORDER BY ea.date DESC, COALESCE(ea.check_in_time, '') DESC`
    )
    .all(...params) as unknown as EmpAttJoinRow[];

  return {
    records: rows.map(mapEmpAttRow),
    today: getTodayJakartaDate(),
  };
}

export function checkInEmployeeLocal(
  user: UserProfile,
  requestedStatus: EmployeeAttendanceStatus,
  note: string
): EmployeeAttendance {
  const db = getSqliteDb();
  const today = getTodayJakartaDate();
  const currentTime = getCurrentJakartaTime();

  const existing = db
    .prepare('SELECT id FROM employee_attendance WHERE user_id = ? AND date = ?')
    .get(user.id, today);
  if (existing) {
    throw new Error('Anda sudah melakukan absen masuk hari ini.');
  }

  let finalStatus: EmployeeAttendanceStatus = requestedStatus;
  if (requestedStatus === 'Hadir' && currentTime > '07:30:00') {
    finalStatus = 'Terlambat';
  }
  const isPresent = finalStatus === 'Hadir' || finalStatus === 'Terlambat';
  const id = `emp_att_${today}_${user.id}`;
  const checkInTime = isPresent ? currentTime : null;
  const finalNote =
    note ||
    (finalStatus === 'Terlambat' ? 'Absen masuk melewati pukul 07:30' : 'Absen masuk mandiri');
  const updatedAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO employee_attendance (id, user_id, date, check_in_time, check_out_time, status, note, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`
  ).run(id, user.id, today, checkInTime, finalStatus, finalNote, updatedAt);

  return {
    id,
    userId: user.id,
    userName: user.nama,
    userRole: user.role,
    userNip: user.nip,
    date: today,
    checkInTime,
    checkOutTime: null,
    status: finalStatus,
    note: finalNote,
    updatedAt,
  };
}

export function checkOutEmployeeLocal(user: UserProfile, note: string): EmployeeAttendance {
  const db = getSqliteDb();
  const today = getTodayJakartaDate();
  const currentTime = getCurrentJakartaTime();

  const existing = db
    .prepare(
      `SELECT ea.*, u.nama AS user_name, u.role AS user_role, u.nip AS user_nip
       FROM employee_attendance ea
       INNER JOIN users u ON u.id = ea.user_id
       WHERE ea.user_id = ? AND ea.date = ?`
    )
    .get(user.id, today) as EmpAttJoinRow | undefined;

  if (!existing) {
    throw new Error('Anda belum mencatat absen masuk hari ini.');
  }
  if (existing.status === 'Izin' || existing.status === 'Sakit') {
    throw new Error('Absen pulang tidak diperlukan untuk status Izin atau Sakit.');
  }
  if (existing.check_out_time) {
    throw new Error('Anda sudah mencatat absen pulang hari ini.');
  }

  const updatedAt = new Date().toISOString();
  const finalNote = note || existing.note;

  db.prepare(
    'UPDATE employee_attendance SET check_out_time = ?, note = ?, updated_at = ? WHERE id = ?'
  ).run(currentTime, finalNote, updatedAt, existing.id);

  return mapEmpAttRow({
    ...existing,
    check_out_time: currentTime,
    note: finalNote,
    updated_at: updatedAt,
  });
}

export function getStudentsLocal(filters: {
  jurusan?: string;
  kelas?: string;
  search?: string;
}): Student[] {
  const db = getSqliteDb();
  const clauses: string[] = [];
  const params: string[] = [];

  if (filters.jurusan && filters.jurusan !== 'ALL') {
    clauses.push('jurusan = ?');
    params.push(filters.jurusan);
  }
  if (filters.kelas && filters.kelas !== 'ALL') {
    clauses.push('kelas = ?');
    params.push(filters.kelas);
  }
  if (filters.search) {
    clauses.push('(LOWER(nama) LIKE ? OR LOWER(nis) LIKE ? OR LOWER(kelas) LIKE ?)');
    const pattern = `%${filters.search.toLowerCase()}%`;
    params.push(pattern, pattern, pattern);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM students ${whereSql} ORDER BY kelas ASC, nama ASC`)
    .all(...params) as unknown as StudentRow[];

  return rows.map(mapStudentRow);
}

export function createStudentLocal(input: {
  nis: string;
  nama: string;
  kelas: string;
  jurusan: MajorCode;
}): Student {
  const db = getSqliteDb();
  const duplicate = db
    .prepare('SELECT id FROM students WHERE LOWER(nis) = LOWER(?)')
    .get(input.nis);
  if (duplicate) {
    throw new Error(`NIS ${input.nis} sudah terdaftar.`);
  }

  const id = `std_${crypto.randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();

  db.prepare(
    'INSERT INTO students (id, nis, nama, kelas, jurusan, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, input.nis, input.nama, input.kelas, input.jurusan, createdAt);

  return {
    id,
    nis: input.nis,
    nama: input.nama,
    kelas: input.kelas,
    jurusan: input.jurusan,
    createdAt,
  };
}

export function updateStudentLocal(
  id: string,
  input: { nis: string; nama: string; kelas: string; jurusan: MajorCode }
): Student {
  const db = getSqliteDb();
  const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as
    | StudentRow
    | undefined;
  if (!existing) {
    throw new Error('Data siswa tidak ditemukan.');
  }

  const duplicate = db
    .prepare('SELECT id FROM students WHERE id != ? AND LOWER(nis) = LOWER(?)')
    .get(id, input.nis);
  if (duplicate) {
    throw new Error(`NIS ${input.nis} sudah digunakan siswa lain.`);
  }

  db.prepare('UPDATE students SET nis = ?, nama = ?, kelas = ?, jurusan = ? WHERE id = ?').run(
    input.nis,
    input.nama,
    input.kelas,
    input.jurusan,
    id
  );

  return {
    id,
    nis: input.nis,
    nama: input.nama,
    kelas: input.kelas,
    jurusan: input.jurusan,
    createdAt: existing.created_at,
  };
}

export function deleteStudentLocal(id: string): void {
  const db = getSqliteDb();
  const res = db.prepare('DELETE FROM students WHERE id = ?').run(id);
  if (res.changes === 0) {
    throw new Error('Data siswa tidak ditemukan.');
  }
}

export function getStudentAttendanceLocal(filters: {
  date?: string;
  startDate?: string;
  endDate?: string;
  jurusan?: string;
  kelas?: string;
  status?: string;
  search?: string;
}): { records: StudentAttendance[]; today: string } {
  const db = getSqliteDb();
  const clauses: string[] = [];
  const params: string[] = [];

  if (filters.date) {
    clauses.push('sa.date = ?');
    params.push(filters.date);
  }
  if (filters.startDate) {
    clauses.push('sa.date >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    clauses.push('sa.date <= ?');
    params.push(filters.endDate);
  }
  if (filters.jurusan && filters.jurusan !== 'ALL') {
    clauses.push('s.jurusan = ?');
    params.push(filters.jurusan);
  }
  if (filters.kelas && filters.kelas !== 'ALL') {
    clauses.push('s.kelas = ?');
    params.push(filters.kelas);
  }
  if (filters.status && filters.status !== 'ALL') {
    clauses.push('sa.status = ?');
    params.push(filters.status);
  }
  if (filters.search) {
    clauses.push('(LOWER(s.nama) LIKE ? OR LOWER(s.nis) LIKE ? OR LOWER(s.kelas) LIKE ?)');
    const pattern = `%${filters.search.toLowerCase()}%`;
    params.push(pattern, pattern, pattern);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT sa.*, s.nis, s.nama AS student_name, s.kelas, s.jurusan, rec.nama AS recorded_by_name
       FROM student_attendance sa
       INNER JOIN students s ON s.id = sa.student_id
       LEFT JOIN users rec ON rec.id = sa.recorded_by
       ${whereSql}
       ORDER BY sa.date DESC, s.kelas ASC, s.nama ASC`
    )
    .all(...params) as unknown as StdAttJoinRow[];

  return {
    records: rows.map(mapStdAttRow),
    today: getTodayJakartaDate(),
  };
}

export function bulkSaveStudentAttendanceLocal(
  recorder: UserProfile,
  date: string,
  items: Array<{ studentId: string; status: StudentAttendanceStatus; note: string }>
): number {
  const db = getSqliteDb();
  const nowIso = new Date().toISOString();
  const checkStudent = db.prepare('SELECT id FROM students WHERE id = ?');
  const upsert = db.prepare(`
    INSERT INTO student_attendance (id, student_id, recorded_by, date, status, note, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(student_id, date) DO UPDATE SET
      recorded_by = excluded.recorded_by,
      status = excluded.status,
      note = excluded.note,
      updated_at = excluded.updated_at
  `);

  let savedCount = 0;
  db.exec('BEGIN');
  try {
    for (const item of items) {
      if (!checkStudent.get(item.studentId)) continue;
      upsert.run(
        `std_att_${date}_${item.studentId}`,
        item.studentId,
        recorder.id,
        date,
        item.status,
        item.note,
        nowIso
      );
      savedCount += 1;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return savedCount;
}

export function listUsersLocal(): UserProfile[] {
  const db = getSqliteDb();
  const rows = db
    .prepare(
      'SELECT id, nama, email, role, nip, jabatan, created_at FROM users ORDER BY nama ASC'
    )
    .all() as unknown as Array<Omit<UserRow, 'password_hash' | 'password_salt'>>;
  return rows.map(mapUserRow);
}

export function createUserLocal(input: {
  nama: string;
  email: string;
  password: string;
  role: Role;
  nip: string;
  jabatan: string;
}): UserProfile {
  const db = getSqliteDb();
  const duplicate = db
    .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
    .get(input.email);
  if (duplicate) {
    throw new Error('Email sudah terdaftar pada sistem autentikasi.');
  }

  const { hash, salt } = hashPassword(input.password);
  const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  const jabatan =
    input.jabatan ||
    (input.role === 'admin'
      ? 'Administrator'
      : input.role === 'guru'
        ? 'Guru Mata Pelajaran'
        : 'Tenaga Kependidikan');

  db.prepare(
    `INSERT INTO users (id, nama, email, role, nip, jabatan, password_hash, password_salt, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.nama, input.email, input.role, input.nip || '-', jabatan, hash, salt, createdAt);

  return {
    id,
    nama: input.nama,
    email: input.email,
    role: input.role,
    nip: input.nip || '-',
    jabatan,
    createdAt,
  };
}

export function updateUserLocal(
  id: string,
  input: {
    nama: string;
    email: string;
    role: Role;
    nip: string;
    jabatan: string;
    password?: string;
  }
): UserProfile {
  const db = getSqliteDb();
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  if (!existing) {
    throw new Error('Pengguna tidak ditemukan.');
  }

  const duplicate = db
    .prepare('SELECT id FROM users WHERE id != ? AND LOWER(email) = LOWER(?)')
    .get(id, input.email);
  if (duplicate) {
    throw new Error('Email sudah digunakan oleh pengguna lain.');
  }

  let hash = existing.password_hash;
  let salt = existing.password_salt;
  if (input.password) {
    const creds = hashPassword(input.password);
    hash = creds.hash;
    salt = creds.salt;
  }

  const jabatan = input.jabatan || existing.jabatan;

  db.prepare(
    `UPDATE users
     SET nama = ?, email = ?, role = ?, nip = ?, jabatan = ?, password_hash = ?, password_salt = ?
     WHERE id = ?`
  ).run(input.nama, input.email, input.role, input.nip || '-', jabatan, hash, salt, id);

  return {
    id,
    nama: input.nama,
    email: input.email,
    role: input.role,
    nip: input.nip || '-',
    jabatan,
    createdAt: existing.created_at,
  };
}

export function hardDeleteUserLocal(id: string): void {
  const db = getSqliteDb();
  const res = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (res.changes === 0) {
    throw new Error('Pengguna tidak ditemukan.');
  }
}
