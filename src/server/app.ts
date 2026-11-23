import dotenv from 'dotenv';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { getTodayJakartaDate } from './date-utils.ts';
import {
  bootstrapDefaultUsersSupabase,
  bulkSaveStudentAttendanceSupabase,
  checkInEmployeeSupabase,
  checkOutEmployeeSupabase,
  createStudentSupabase,
  createUserSupabase,
  deleteStudentSupabase,
  getAuthStatusSupabase,
  getDashboardSupabase,
  getEmployeeAttendanceSupabase,
  getStudentAttendanceSupabase,
  getStudentsSupabase,
  getSupabaseConfigStatus,
  hardDeleteUserSupabase,
  hasAdminPrivileges,
  isSupabaseConfigured,
  listUsersSupabase,
  loginWithSupabase,
  registerWithSupabase,
  runWithSupabaseUserToken,
  signOutSupabase,
  updateStudentSupabase,
  updateUserSupabase,
  verifySupabaseToken,
} from './supabase-repo.ts';
import type {
  EmployeeAttendanceStatus,
  MajorCode,
  Role,
  StudentAttendanceStatus,
  UserProfile,
} from '../types.ts';

dotenv.config({ path: '.env.local' });
dotenv.config();

interface AuthenticatedRequest extends Request {
  authUser?: UserProfile;
  authToken?: string;
}

const VALID_ROLES: Role[] = ['admin', 'guru', 'tenaga_kependidikan'];
const VALID_MAJORS: MajorCode[] = ['TKJ', 'DKV', 'AK', 'BC', 'MPLB', 'BD'];
const VALID_EMP_STATUS: EmployeeAttendanceStatus[] = ['Hadir', 'Terlambat', 'Izin', 'Sakit'];
const VALID_STD_STATUS: StudentAttendanceStatus[] = ['Hadir', 'Sakit', 'Izin', 'Alpha'];

type LocalStoreModule = typeof import('./store.ts');
let localStorePromise: Promise<LocalStoreModule> | null = null;

async function getLocalStore(): Promise<LocalStoreModule> {
  if (process.env.VERCEL) {
    throw new Error(
      'Konfigurasi Supabase di Vercel belum lengkap. Tambahkan SUPABASE_URL, SUPABASE_ANON_KEY, dan SUPABASE_SERVICE_ROLE_KEY pada Vercel Project Settings → Environment Variables lalu Redeploy.'
    );
  }
  if (!localStorePromise) {
    localStorePromise = import('./store.ts');
  }
  return localStorePromise;
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesi tidak valid. Silakan masuk terlebih dahulu.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (isSupabaseConfigured()) {
    try {
      const supaUser = await verifySupabaseToken(token);
      if (!supaUser) {
        res.status(401).json({ error: 'Sesi Supabase tidak valid atau telah berakhir.' });
        return;
      }
      req.authUser = supaUser;
      req.authToken = token;
      runWithSupabaseUserToken(token, () => next());
      return;
    } catch {
      res.status(401).json({ error: 'Gagal memverifikasi token Supabase.' });
      return;
    }
  }

  try {
    const store = await getLocalStore();
    const localUser = store.verifyTokenLocal(token);
    if (!localUser) {
      res.status(401).json({ error: 'Sesi telah berakhir atau akun dihapus. Silakan masuk ulang.' });
      return;
    }

    req.authUser = localUser;
    req.authToken = token;
    next();
  } catch (err) {
    res.status(503).json({
      error: err instanceof Error ? err.message : 'Layanan database tidak tersedia.',
    });
  }
}

function requireRole(roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      res.status(403).json({ error: 'Anda tidak memiliki hak akses untuk fitur ini.' });
      return;
    }
    next();
  };
}

export function createApiApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const supaStatus = getSupabaseConfigStatus();
    res.json({
      status: 'ok',
      backend: supaStatus.configured
        ? 'supabase-postgresql'
        : process.env.VERCEL
          ? 'unconfigured-vercel'
          : 'sqlite-relational',
      supabaseConfigured: supaStatus.configured,
      missingSecrets: supaStatus.missingKeys,
      keyDiagnostics: supaStatus.keyDiagnostics,
      time: new Date().toISOString(),
    });
  });

  app.get('/api/auth/status', async (_req, res) => {
    try {
      if (isSupabaseConfigured()) {
        const status = await getAuthStatusSupabase();
        res.json({
          ...status,
          backend: 'supabase-postgresql',
          hasAdminPrivileges: hasAdminPrivileges(),
        });
        return;
      }
      const store = await getLocalStore();
      res.json({ ...store.getAuthStatusLocal(), backend: 'sqlite-relational' });
    } catch (err) {
      res.status(process.env.VERCEL && !isSupabaseConfigured() ? 503 : 500).json({
        error: err instanceof Error ? err.message : 'Gagal memeriksa status autentikasi.',
      });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
      return;
    }

    if (isSupabaseConfigured()) {
      try {
        const result = await loginWithSupabase(email, password);
        res.json(result);
      } catch (err) {
        res.status(401).json({ error: err instanceof Error ? err.message : 'Gagal login.' });
      }
      return;
    }

    try {
      const store = await getLocalStore();
      const result = store.loginLocal(email, password);
      if (!result) {
        res.status(401).json({ error: 'Email atau kata sandi salah.' });
        return;
      }
      res.json(result);
    } catch (err) {
      res.status(503).json({ error: err instanceof Error ? err.message : 'Database belum siap.' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    const nama = String(req.body?.nama || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const nip = String(req.body?.nip || '').trim() || '-';
    const jabatan = String(req.body?.jabatan || '').trim();
    const requestedRole = String(req.body?.role || 'tenaga_kependidikan') as Exclude<Role, 'admin'>;

    if (!nama || !email || password.length < 6) {
      res.status(400).json({ error: 'Nama, email valid, dan kata sandi minimal 6 karakter wajib diisi.' });
      return;
    }

    if (isSupabaseConfigured()) {
      try {
        const result = await registerWithSupabase({
          nama,
          email,
          password,
          nip,
          jabatan,
          role: requestedRole,
        });
        res.status(201).json(result);
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal mendaftar.' });
      }
      return;
    }

    try {
      const store = await getLocalStore();
      const result = store.registerLocal({
        nama,
        email,
        password,
        nip,
        jabatan,
        role: requestedRole,
      });
      res.status(201).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mendaftar.';
      res.status(msg.includes('sudah terdaftar') ? 409 : 400).json({ error: msg });
    }
  });

  app.post('/api/auth/bootstrap-demo', async (_req, res) => {
    try {
      if (isSupabaseConfigured()) {
        const result = await bootstrapDefaultUsersSupabase();
        res.status(201).json(result);
        return;
      }
      const store = await getLocalStore();
      const status = store.getAuthStatusLocal();
      if (status.hasUsers) {
        res.status(403).json({ error: 'Akun pengguna sudah tersedia.' });
        return;
      }
      res.status(400).json({ error: 'Silakan daftar akun admin melalui formulir.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat akun awal.';
      res.status(msg.includes('sudah tersedia') ? 403 : 400).json({ error: msg });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser });
  });

  app.post('/api/auth/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
    if (isSupabaseConfigured() && req.authToken) {
      await signOutSupabase(req.authToken);
    } else if (req.authToken) {
      const store = await getLocalStore();
      store.logoutLocal(req.authToken);
    }
    res.json({ ok: true });
  });

  app.get('/api/dashboard', requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    try {
      if (isSupabaseConfigured()) {
        res.json(await getDashboardSupabase(user));
        return;
      }
      const store = await getLocalStore();
      res.json(store.getDashboardLocal(user));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat dashboard.' });
    }
  });

  app.get('/api/attendance/employees', requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const filters = {
      startDate: String(req.query.startDate || '').trim(),
      endDate: String(req.query.endDate || '').trim(),
      status: String(req.query.status || '').trim(),
      role: String(req.query.role || '').trim(),
      search: String(req.query.search || '').trim(),
      scope: String(req.query.scope || '').trim(),
    };

    try {
      if (isSupabaseConfigured()) {
        res.json(await getEmployeeAttendanceSupabase(user, filters));
        return;
      }
      const store = await getLocalStore();
      res.json(store.getEmployeeAttendanceLocal(user, filters));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat absensi karyawan.' });
    }
  });

  app.post('/api/attendance/employees/check-in', requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const requestedStatus = String(req.body?.status || 'Hadir') as EmployeeAttendanceStatus;
    const note = String(req.body?.note || '').trim().slice(0, 240);

    if (!VALID_EMP_STATUS.includes(requestedStatus)) {
      res.status(400).json({ error: 'Status absensi karyawan tidak valid.' });
      return;
    }

    try {
      if (isSupabaseConfigured()) {
        const record = await checkInEmployeeSupabase(user, requestedStatus, note);
        res.status(201).json({ record });
        return;
      }
      const store = await getLocalStore();
      const record = store.checkInEmployeeLocal(user, requestedStatus, note);
      res.status(201).json({ record });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat absen masuk.';
      res.status(msg.includes('sudah') ? 409 : 400).json({ error: msg });
    }
  });

  app.post('/api/attendance/employees/check-out', requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const note = String(req.body?.note || '').trim().slice(0, 240);

    try {
      if (isSupabaseConfigured()) {
        const record = await checkOutEmployeeSupabase(user, note);
        res.json({ record });
        return;
      }
      const store = await getLocalStore();
      const record = store.checkOutEmployeeLocal(user, note);
      res.json({ record });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal absen pulang.';
      res.status(msg.includes('belum') ? 404 : msg.includes('sudah') ? 409 : 400).json({ error: msg });
    }
  });

  app.get('/api/students', requireAuth, requireRole(['admin', 'guru']), async (req, res) => {
    const filters = {
      jurusan: String(req.query.jurusan || '').trim(),
      kelas: String(req.query.kelas || '').trim(),
      search: String(req.query.search || '').trim(),
    };

    try {
      if (isSupabaseConfigured()) {
        res.json({ students: await getStudentsSupabase(filters) });
        return;
      }
      const store = await getLocalStore();
      res.json({ students: store.getStudentsLocal(filters) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat data siswa.' });
    }
  });

  app.post('/api/students', requireAuth, requireRole(['admin']), async (req, res) => {
    const nis = String(req.body?.nis || '').trim();
    const nama = String(req.body?.nama || '').trim();
    const kelas = String(req.body?.kelas || '').trim();
    const jurusan = String(req.body?.jurusan || '').trim().toUpperCase() as MajorCode;

    if (!nis || !nama || !kelas || !VALID_MAJORS.includes(jurusan)) {
      res.status(400).json({ error: 'NIS, nama lengkap, kelas, dan jurusan valid wajib diisi.' });
      return;
    }

    try {
      if (isSupabaseConfigured()) {
        res.status(201).json({ student: await createStudentSupabase({ nis, nama, kelas, jurusan }) });
        return;
      }
      const store = await getLocalStore();
      res.status(201).json({ student: store.createStudentLocal({ nis, nama, kelas, jurusan }) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menambah siswa.';
      res.status(msg.includes('sudah terdaftar') ? 409 : 400).json({ error: msg });
    }
  });

  app.put('/api/students/:id', requireAuth, requireRole(['admin']), async (req, res) => {
    const nis = String(req.body?.nis || '').trim();
    const nama = String(req.body?.nama || '').trim();
    const kelas = String(req.body?.kelas || '').trim();
    const jurusan = String(req.body?.jurusan || '').trim().toUpperCase() as MajorCode;

    if (!nis || !nama || !kelas || !VALID_MAJORS.includes(jurusan)) {
      res.status(400).json({ error: 'NIS, nama lengkap, kelas, dan jurusan valid wajib diisi.' });
      return;
    }

    try {
      if (isSupabaseConfigured()) {
        res.json({
          student: await updateStudentSupabase(String(req.params.id), { nis, nama, kelas, jurusan }),
        });
        return;
      }
      const store = await getLocalStore();
      res.json({
        student: store.updateStudentLocal(String(req.params.id), { nis, nama, kelas, jurusan }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui siswa.';
      res.status(msg.includes('tidak ditemukan') ? 404 : msg.includes('sudah') ? 409 : 400).json({
        error: msg,
      });
    }
  });

  app.delete('/api/students/:id', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
      if (isSupabaseConfigured()) {
        await deleteStudentSupabase(String(req.params.id));
        res.json({ ok: true });
        return;
      }
      const store = await getLocalStore();
      store.deleteStudentLocal(String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus siswa.';
      res.status(msg.includes('tidak ditemukan') ? 404 : 400).json({ error: msg });
    }
  });

  app.get('/api/attendance/students', requireAuth, requireRole(['admin', 'guru']), async (req, res) => {
    const filters = {
      date: String(req.query.date || '').trim(),
      startDate: String(req.query.startDate || '').trim(),
      endDate: String(req.query.endDate || '').trim(),
      jurusan: String(req.query.jurusan || '').trim(),
      kelas: String(req.query.kelas || '').trim(),
      status: String(req.query.status || '').trim(),
      search: String(req.query.search || '').trim(),
    };

    try {
      if (isSupabaseConfigured()) {
        res.json(await getStudentAttendanceSupabase(filters));
        return;
      }
      const store = await getLocalStore();
      res.json(store.getStudentAttendanceLocal(filters));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat absensi siswa.' });
    }
  });

  app.post('/api/attendance/students/bulk', requireAuth, requireRole(['admin', 'guru']), async (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const date = String(req.body?.date || getTodayJakartaDate()).trim();
    const items = Array.isArray(req.body?.records) ? req.body.records : [];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Format tanggal harus YYYY-MM-DD.' });
      return;
    }
    if (items.length === 0) {
      res.status(400).json({ error: 'Tidak ada data absensi siswa yang dikirim.' });
      return;
    }

    const sanitizedItems = items
      .filter((i: { studentId?: string; status?: StudentAttendanceStatus }) =>
        Boolean(i?.studentId) && VALID_STD_STATUS.includes(i.status as StudentAttendanceStatus)
      )
      .map((i: { studentId: string; status: StudentAttendanceStatus; note?: string }) => ({
        studentId: String(i.studentId),
        status: i.status,
        note: String(i.note || '').trim().slice(0, 200),
      }));

    try {
      if (isSupabaseConfigured()) {
        const savedCount = await bulkSaveStudentAttendanceSupabase(user, date, sanitizedItems);
        res.json({ ok: true, savedCount, date });
        return;
      }
      const store = await getLocalStore();
      const savedCount = store.bulkSaveStudentAttendanceLocal(user, date, sanitizedItems);
      res.json({ ok: true, savedCount, date });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan absensi siswa.' });
    }
  });

  app.get('/api/users', requireAuth, requireRole(['admin']), async (_req, res) => {
    try {
      if (isSupabaseConfigured()) {
        res.json({ users: await listUsersSupabase() });
        return;
      }
      const store = await getLocalStore();
      res.json({ users: store.listUsersLocal() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memuat daftar user.' });
    }
  });

  app.post('/api/users', requireAuth, requireRole(['admin']), async (req, res) => {
    const nama = String(req.body?.nama || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const role = String(req.body?.role || '') as Role;
    const nip = String(req.body?.nip || '').trim() || '-';
    const jabatan = String(req.body?.jabatan || '').trim();

    if (!nama || !email || password.length < 6 || !VALID_ROLES.includes(role)) {
      res.status(400).json({
        error: 'Nama, email valid, kata sandi minimal 6 karakter, dan role valid wajib diisi.',
      });
      return;
    }

    try {
      if (isSupabaseConfigured()) {
        res.status(201).json({
          user: await createUserSupabase({ nama, email, password, role, nip, jabatan }),
        });
        return;
      }
      const store = await getLocalStore();
      res.status(201).json({
        user: store.createUserLocal({ nama, email, password, role, nip, jabatan }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat user.';
      res.status(msg.includes('sudah') ? 409 : 400).json({ error: msg });
    }
  });

  app.put('/api/users/:id', requireAuth, requireRole(['admin']), async (req, res) => {
    const nama = String(req.body?.nama || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || '') as Role;
    const nip = String(req.body?.nip || '').trim() || '-';
    const jabatan = String(req.body?.jabatan || '').trim();
    const newPassword = String(req.body?.password || '');

    if (!nama || !email || !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: 'Nama, email, dan role valid wajib diisi.' });
      return;
    }
    if (newPassword && newPassword.length < 6) {
      res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
      return;
    }

    try {
      const payload = {
        nama,
        email,
        role,
        nip,
        jabatan,
        ...(newPassword ? { password: newPassword } : {}),
      };
      if (isSupabaseConfigured()) {
        res.json({ user: await updateUserSupabase(String(req.params.id), payload) });
        return;
      }
      const store = await getLocalStore();
      res.json({ user: store.updateUserLocal(String(req.params.id), payload) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui user.';
      res.status(msg.includes('tidak ditemukan') ? 404 : msg.includes('sudah') ? 409 : 400).json({
        error: msg,
      });
    }
  });

  app.delete('/api/users/:id', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
    const targetId = String(req.params.id);
    if (req.authUser?.id === targetId) {
      res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' });
      return;
    }

    try {
      if (isSupabaseConfigured()) {
        await hardDeleteUserSupabase(targetId);
        res.json({ ok: true, deletedId: targetId });
        return;
      }
      const store = await getLocalStore();
      store.hardDeleteUserLocal(targetId);
      res.json({ ok: true, deletedId: targetId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus user.';
      res.status(msg.includes('tidak ditemukan') ? 404 : 400).json({ error: msg });
    }
  });

  return app;
}
