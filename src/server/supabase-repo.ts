import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
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
import { getCurrentJakartaTime, getTodayJakartaDate } from './date-utils.ts';

let adminClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;
const requestTokenStorage = new AsyncLocalStorage<string>();

export function runWithSupabaseUserToken<T>(token: string, fn: () => T): T {
  return requestTokenStorage.run(token, fn);
}

function cleanEnv(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/^["']|["']$/g, '').trim();
}

function getSupabaseEnv() {
  const url =
    cleanEnv(process.env.SUPABASE_URL) ||
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    cleanEnv(process.env.VITE_SUPABASE_URL);

  const anon =
    cleanEnv(process.env.SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.VITE_SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.SUPABASE_KEY);

  const service =
    cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    cleanEnv(process.env.SUPABASE_SERVICE_KEY);

  return { url, anon, service };
}

export function isSupabaseConfigured(): boolean {
  const { url, anon, service } = getSupabaseEnv();
  const isValidUrl = /^https?:\/\/.+/i.test(url) && !url.includes('YOUR_PROJECT_REF') && !url.includes('MY_SUPABASE_URL');
  const isValidAnon =
    Boolean(anon) && !anon.includes('YOUR_SUPABASE') && !anon.includes('MY_SUPABASE');
  const isValidService =
    Boolean(service) && !service.includes('YOUR_SUPABASE') && !service.includes('MY_SUPABASE');

  return Boolean(isValidUrl && isValidAnon && isValidService);
}

function classifySupabaseKey(key: string): {
  format: 'jwt' | 'sb_secret' | 'sb_publishable' | 'other' | 'missing';
  jwtRole?: string;
} {
  if (!key) return { format: 'missing' };
  if (key.startsWith('sb_secret_')) return { format: 'sb_secret' };
  if (key.startsWith('sb_publishable_')) return { format: 'sb_publishable' };
  const parts = key.split('.');
  if (parts.length === 3 && key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
        role?: string;
      };
      return { format: 'jwt', jwtRole: payload.role || 'unknown' };
    } catch {
      return { format: 'jwt', jwtRole: 'invalid' };
    }
  }
  return { format: 'other' };
}

export function getSupabaseConfigStatus(): {
  configured: boolean;
  missingKeys: string[];
  keyDiagnostics: {
    anonKeyFormat: string;
    anonJwtRole?: string;
    serviceKeyFormat: string;
    serviceJwtRole?: string;
    serviceEqualsAnon: boolean;
  };
} {
  const { url, anon, service } = getSupabaseEnv();
  const missingKeys: string[] = [];
  if (!/^https?:\/\/.+/i.test(url) || url.includes('YOUR_PROJECT_REF') || url.includes('MY_SUPABASE_URL')) {
    missingKeys.push('SUPABASE_URL');
  }
  if (!anon || anon.includes('YOUR_SUPABASE') || anon.includes('MY_SUPABASE')) {
    missingKeys.push('SUPABASE_ANON_KEY');
  }
  if (!service || service.includes('YOUR_SUPABASE') || service.includes('MY_SUPABASE')) {
    missingKeys.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  const anonInfo = classifySupabaseKey(anon);
  const serviceInfo = classifySupabaseKey(service);

  return {
    configured: missingKeys.length === 0,
    missingKeys,
    keyDiagnostics: {
      anonKeyFormat: anonInfo.format,
      ...(anonInfo.jwtRole ? { anonJwtRole: anonInfo.jwtRole } : {}),
      serviceKeyFormat: serviceInfo.format,
      ...(serviceInfo.jwtRole ? { serviceJwtRole: serviceInfo.jwtRole } : {}),
      serviceEqualsAnon: Boolean(anon && service && anon === service),
    },
  };
}

export function hasAdminPrivileges(): boolean {
  const { service } = getSupabaseEnv();
  const info = classifySupabaseKey(service);
  return info.format === 'sb_secret' || (info.format === 'jwt' && info.jwtRole === 'service_role');
}

function createSupabaseUserClient(userToken: string): SupabaseClient {
  const { url, anon } = getSupabaseEnv();
  return createClient(url, anon, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    },
  });
}

function getSupabaseRawAdmin(): SupabaseClient {
  if (!adminClient) {
    const { url, service } = getSupabaseEnv();
    const isNewKeyFormat = service.startsWith('sb_secret_') || service.startsWith('sb_publishable_');
    adminClient = createClient(url, service, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      ...(isNewKeyFormat
        ? {
            global: {
              fetch: (input: RequestInfo | URL, init?: RequestInit) => {
                const headers = new Headers(init?.headers);
                if (headers.get('Authorization') === `Bearer ${service}`) {
                  headers.delete('Authorization');
                }
                return fetch(input, { ...init, headers });
              },
            },
          }
        : {}),
    });
  }
  return adminClient;
}

function getSupabaseAdmin(): SupabaseClient {
  if (!hasAdminPrivileges()) {
    const activeToken = requestTokenStorage.getStore();
    if (activeToken) {
      return createSupabaseUserClient(activeToken);
    }
  }
  return getSupabaseRawAdmin();
}

function getSupabaseAuth(): SupabaseClient {
  if (!authClient) {
    const { url, anon } = getSupabaseEnv();
    const isNewPublishable = anon.startsWith('sb_publishable_');
    authClient = createClient(url, anon, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      ...(isNewPublishable
        ? {
            global: {
              fetch: (input: RequestInfo | URL, init?: RequestInit) => {
                const headers = new Headers(init?.headers);
                if (headers.get('Authorization') === `Bearer ${anon}`) {
                  headers.delete('Authorization');
                }
                return fetch(input, { ...init, headers });
              },
            },
          }
        : {}),
    });
  }
  return authClient;
}

interface ProfileRow {
  id: string;
  nama: string;
  email: string;
  role: Role;
  nip: string;
  jabatan: string;
  created_at: string;
}

interface StudentRow {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  jurusan: MajorCode;
  created_at: string;
}

interface EmployeeAttendanceJoinedRow {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: EmployeeAttendanceStatus;
  note: string;
  updated_at: string;
  profiles: {
    nama: string;
    role: Role;
    nip: string;
  } | null;
}

interface StudentAttendanceJoinedRow {
  id: string;
  student_id: string;
  recorded_by: string | null;
  date: string;
  status: StudentAttendanceStatus;
  note: string;
  updated_at: string;
  students: {
    nis: string;
    nama: string;
    kelas: string;
    jurusan: MajorCode;
  } | null;
  recorder: {
    nama: string;
  } | null;
}

function mapProfile(row: ProfileRow): UserProfile {
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

function mapStudent(row: StudentRow): Student {
  return {
    id: row.id,
    nis: row.nis,
    nama: row.nama,
    kelas: row.kelas,
    jurusan: row.jurusan,
    createdAt: row.created_at,
  };
}

function mapEmployeeAttendance(row: EmployeeAttendanceJoinedRow): EmployeeAttendance {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.profiles?.nama || 'Karyawan',
    userRole: row.profiles?.role || 'tenaga_kependidikan',
    userNip: row.profiles?.nip || '-',
    date: row.date,
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    status: row.status,
    note: row.note,
    updatedAt: row.updated_at,
  };
}

function mapStudentAttendance(row: StudentAttendanceJoinedRow): StudentAttendance {
  return {
    id: row.id,
    studentId: row.student_id,
    nis: row.students?.nis || '-',
    studentName: row.students?.nama || 'Siswa',
    kelas: row.students?.kelas || '-',
    jurusan: row.students?.jurusan || 'TKJ',
    date: row.date,
    status: row.status,
    note: row.note,
    recordedByUserId: row.recorded_by || '',
    recordedByName: row.recorder?.nama || 'Guru/Admin',
    updatedAt: row.updated_at,
  };
}

export async function getAuthStatusSupabase(): Promise<{ hasUsers: boolean; userCount: number }> {
  const admin = getSupabaseAdmin();
  const { count, error } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  const total = count || 0;
  return { hasUsers: total > 0, userCount: total };
}

async function ensureProfileForAuthUser(
  authUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  },
  userToken?: string
): Promise<UserProfile> {
  const db =
    !hasAdminPrivileges() && userToken ? createSupabaseUserClient(userToken) : getSupabaseAdmin();

  const { data: existing } = await db
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (existing) {
    return mapProfile(existing as ProfileRow);
  }

  const { count } = await db.from('profiles').select('*', { count: 'exact', head: true });
  const isFirst = (count || 0) === 0;
  const metaRole = String(authUser.user_metadata?.role || '');
  const assignedRole: Role = isFirst
    ? 'admin'
    : metaRole === 'admin' || metaRole === 'guru' || metaRole === 'tenaga_kependidikan'
      ? metaRole
      : 'tenaga_kependidikan';

  const email = authUser.email || `${authUser.id}@smkprimaunggul.sch.id`;
  const nama = String(authUser.user_metadata?.nama || '').trim() || email.split('@')[0];
  const nip = String(authUser.user_metadata?.nip || '').trim() || '-';
  const jabatan =
    String(authUser.user_metadata?.jabatan || '').trim() ||
    (assignedRole === 'admin'
      ? 'Administrator Sistem'
      : assignedRole === 'guru'
        ? 'Guru Mata Pelajaran'
        : 'Tenaga Kependidikan');

  const { data: inserted, error } = await db
    .from('profiles')
    .upsert({
      id: authUser.id,
      nama,
      email,
      role: assignedRole,
      nip,
      jabatan,
    })
    .select('*')
    .single();

  if (error || !inserted) {
    throw new Error(error?.message || 'Gagal menyinkronkan profil pengguna Supabase.');
  }
  return mapProfile(inserted as ProfileRow);
}

export async function verifySupabaseToken(token: string): Promise<UserProfile | null> {
  const client = hasAdminPrivileges() ? getSupabaseRawAdmin() : getSupabaseAuth();
  const { data: userRes, error: authErr } = await client.auth.getUser(token);
  if (authErr || !userRes.user) return null;

  return ensureProfileForAuthUser(userRes.user, token);
}

export async function loginWithSupabase(
  email: string,
  password: string
): Promise<{ token: string; user: UserProfile }> {
  const auth = getSupabaseAuth();

  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      throw new Error(
        'Email belum dikonfirmasi di Supabase Auth. Matikan "Confirm email" di Supabase Dashboard atau isi SUPABASE_SERVICE_ROLE_KEY dengan Secret key (sb_secret_... / service_role).'
      );
    }
    throw new Error('Email atau kata sandi salah.');
  }
  if (!data.session || !data.user) {
    throw new Error('Email atau kata sandi salah.');
  }

  const profile = await ensureProfileForAuthUser(data.user, data.session.access_token);

  return {
    token: data.session.access_token,
    user: profile,
  };
}

export async function signOutSupabase(token: string): Promise<void> {
  try {
    if (hasAdminPrivileges()) {
      const admin = getSupabaseRawAdmin();
      await admin.auth.admin.signOut(token);
    } else {
      const client = createSupabaseUserClient(token);
      await client.auth.signOut();
    }
  } catch {
    // ignore signOut errors if token already expired
  }
}

export async function registerWithSupabase(input: {
  nama: string;
  email: string;
  password: string;
  nip?: string;
  jabatan?: string;
  role?: Exclude<Role, 'admin'>;
}): Promise<{ token: string; user: UserProfile }> {
  const admin = getSupabaseAdmin();
  const auth = getSupabaseAuth();

  const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true });
  const isFirst = (count || 0) === 0;
  const assignedRole: Role = isFirst
    ? 'admin'
    : input.role === 'guru'
      ? 'guru'
      : 'tenaga_kependidikan';
  const resolvedJabatan =
    input.jabatan ||
    (assignedRole === 'admin'
      ? 'Administrator Sistem'
      : assignedRole === 'guru'
        ? 'Guru Mata Pelajaran'
        : 'Tenaga Kependidikan');

  if (hasAdminPrivileges()) {
    const rawAdmin = getSupabaseRawAdmin();
    const { data: created, error: createErr } = await rawAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        nama: input.nama,
        role: assignedRole,
        nip: input.nip || '-',
        jabatan: resolvedJabatan,
      },
    });

    if (createErr || !created.user) {
      const msg = createErr?.message || '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
        throw new Error('Email sudah terdaftar di sistem autentikasi.');
      }
      throw new Error(msg || 'Gagal mendaftarkan akun di Supabase Auth.');
    }

    await rawAdmin.from('profiles').upsert({
      id: created.user.id,
      nama: input.nama,
      email: input.email,
      role: assignedRole,
      nip: input.nip || '-',
      jabatan: resolvedJabatan,
    });

    const { data: signInData, error: signInErr } = await auth.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (signInErr || !signInData.session || !signInData.user) {
      throw new Error('Akun berhasil dibuat, silakan masuk melalui halaman login.');
    }

    const profile = await ensureProfileForAuthUser(signInData.user, signInData.session.access_token);
    return {
      token: signInData.session.access_token,
      user: profile,
    };
  }

  const { data: signUpData, error: signUpErr } = await auth.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        nama: input.nama,
        role: assignedRole,
        nip: input.nip || '-',
        jabatan: resolvedJabatan,
      },
    },
  });

  if (signUpErr || !signUpData.user) {
    const msg = signUpErr?.message || '';
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
      throw new Error('Email sudah terdaftar di sistem autentikasi.');
    }
    throw new Error(msg || 'Gagal mendaftarkan akun di Supabase Auth.');
  }

  if (signUpData.session) {
    const profile = await ensureProfileForAuthUser(
      signUpData.user,
      signUpData.session.access_token
    );
    return {
      token: signUpData.session.access_token,
      user: profile,
    };
  }

  return loginWithSupabase(input.email, input.password);
}

export async function bootstrapDefaultUsersSupabase(): Promise<{
  token: string;
  user: UserProfile;
}> {
  const admin = getSupabaseAdmin();
  const auth = getSupabaseAuth();

  const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true });
  if ((count || 0) > 0) {
    throw new Error('Akun pengguna sudah tersedia. Silakan masuk menggunakan email dan kata sandi Anda.');
  }

  const defaults: Array<{
    email: string;
    password: string;
    nama: string;
    role: Role;
    nip: string;
    jabatan: string;
  }> = [
    {
      email: 'admin@smkprimaunggul.sch.id',
      password: 'admin123',
      nama: 'Drs. Hendra Wijaya, M.Pd.',
      role: 'admin',
      nip: '197804122005011004',
      jabatan: 'Kepala Tata Usaha & Administrator',
    },
    {
      email: 'guru@smkprimaunggul.sch.id',
      password: 'guru123',
      nama: 'Siti Nurhaliza, S.Kom.',
      role: 'guru',
      nip: '198906152014022003',
      jabatan: 'Guru Produktif TKJ',
    },
    {
      email: 'tendik@smkprimaunggul.sch.id',
      password: 'tendik123',
      nama: 'Budi Santoso',
      role: 'tenaga_kependidikan',
      nip: '199508092020121002',
      jabatan: 'Staf Administrasi Akademik',
    },
  ];

  if (!hasAdminPrivileges()) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY di Secrets masih berisi Publishable key (sb_publishable_...), bukan Secret key (sb_secret_... / service_role). Ganti SUPABASE_SERVICE_ROLE_KEY dengan Secret key dari Supabase Dashboard → Settings → API Keys untuk membuat 3 akun otomatis, atau langsung daftar sebagai Admin Pertama menggunakan email Gmail aktif pada formulir di atas.'
    );
  }

  const rawAdmin = getSupabaseRawAdmin();
  const { data: authList, error: listErr } = await rawAdmin.auth.admin.listUsers();
  if (listErr) {
    throw new Error(listErr.message);
  }

  for (const item of defaults) {
    const existingAuth = authList?.users.find(
      (u) => u.email?.toLowerCase() === item.email.toLowerCase()
    );

    let userId: string;
    if (existingAuth) {
      const { error: updErr } = await rawAdmin.auth.admin.updateUserById(existingAuth.id, {
        password: item.password,
        email_confirm: true,
        user_metadata: {
          nama: item.nama,
          role: item.role,
          nip: item.nip,
          jabatan: item.jabatan,
        },
      });
      if (updErr) throw new Error(updErr.message);
      userId = existingAuth.id;
    } else {
      const { data: created, error: createErr } = await rawAdmin.auth.admin.createUser({
        email: item.email,
        password: item.password,
        email_confirm: true,
        user_metadata: {
          nama: item.nama,
          role: item.role,
          nip: item.nip,
          jabatan: item.jabatan,
        },
      });
      if (createErr || !created.user) {
        throw new Error(createErr?.message || `Gagal membuat akun ${item.email}.`);
      }
      userId = created.user.id;
    }

    await rawAdmin.from('profiles').upsert({
      id: userId,
      nama: item.nama,
      email: item.email,
      role: item.role,
      nip: item.nip,
      jabatan: item.jabatan,
    });
  }

  return loginWithSupabase(defaults[0].email, defaults[0].password);
}

export async function getDashboardSupabase(user: UserProfile): Promise<DashboardData> {
  const admin = getSupabaseAdmin();
  const today = getTodayJakartaDate();
  const monthPrefix = today.slice(0, 7);

  const [
    usersCountRes,
    studentsCountRes,
    myTodayRes,
    myMonthRes,
    empTodayRes,
    stdTodayRes,
    recentEmpRes,
    recentStdRes,
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('students').select('*', { count: 'exact', head: true }),
    admin
      .from('employee_attendance')
      .select('*, profiles(nama, role, nip)')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),
    admin
      .from('employee_attendance')
      .select('status, date')
      .eq('user_id', user.id)
      .gte('date', `${monthPrefix}-01`),
    admin.from('employee_attendance').select('status').eq('date', today),
    admin.from('student_attendance').select('status').eq('date', today),
    user.role === 'admin'
      ? admin
          .from('employee_attendance')
          .select('*, profiles(nama, role, nip)')
          .order('date', { ascending: false })
          .order('check_in_time', { ascending: false, nullsFirst: false })
          .limit(8)
      : admin
          .from('employee_attendance')
          .select('*, profiles(nama, role, nip)')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(8),
    user.role === 'tenaga_kependidikan'
      ? Promise.resolve({ data: [] })
      : admin
          .from('student_attendance')
          .select('*, students(nis, nama, kelas, jurusan), recorder:profiles!recorded_by(nama)')
          .order('updated_at', { ascending: false })
          .limit(8),
  ]);

  const myMonthRows = (myMonthRes.data || []) as Array<{ status: EmployeeAttendanceStatus }>;
  const empTodayRows = (empTodayRes.data || []) as Array<{ status: EmployeeAttendanceStatus }>;
  const stdTodayRows = (stdTodayRes.data || []) as Array<{ status: StudentAttendanceStatus }>;

  return {
    today,
    myAttendanceToday: myTodayRes.data
      ? mapEmployeeAttendance(myTodayRes.data as unknown as EmployeeAttendanceJoinedRow)
      : null,
    stats: {
      totalUsers: usersCountRes.count || 0,
      totalStudents: studentsCountRes.count || 0,
      employeesPresentToday: empTodayRows.filter(
        (r) => r.status === 'Hadir' || r.status === 'Terlambat'
      ).length,
      totalEmployees: usersCountRes.count || 0,
      studentsPresentToday: stdTodayRows.filter((r) => r.status === 'Hadir').length,
      studentsRecordedToday: stdTodayRows.length,
      myMonthlyPresent: myMonthRows.filter(
        (r) => r.status === 'Hadir' || r.status === 'Terlambat'
      ).length,
      myMonthlyTotal: myMonthRows.length,
    },
    recentEmployeeAttendance: ((recentEmpRes.data || []) as unknown as EmployeeAttendanceJoinedRow[]).map(
      mapEmployeeAttendance
    ),
    recentStudentAttendance: ((recentStdRes.data || []) as unknown as StudentAttendanceJoinedRow[]).map(
      mapStudentAttendance
    ),
  };
}

export async function getEmployeeAttendanceSupabase(
  user: UserProfile,
  filters: {
    startDate?: string;
    endDate?: string;
    status?: string;
    role?: string;
    search?: string;
    scope?: string;
  }
): Promise<{ records: EmployeeAttendance[]; today: string }> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from('employee_attendance')
    .select('*, profiles(nama, role, nip)')
    .order('date', { ascending: false })
    .order('check_in_time', { ascending: false });

  if (user.role !== 'admin' || filters.scope === 'self') {
    query = query.eq('user_id', user.id);
  }
  if (filters.startDate) query = query.gte('date', filters.startDate);
  if (filters.endDate) query = query.lte('date', filters.endDate);
  if (filters.status && filters.status !== 'ALL') query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let mapped = ((data || []) as unknown as EmployeeAttendanceJoinedRow[]).map(mapEmployeeAttendance);

  if (filters.role && filters.role !== 'ALL') {
    mapped = mapped.filter((r) => r.userRole === filters.role);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    mapped = mapped.filter(
      (r) =>
        r.userName.toLowerCase().includes(q) ||
        r.userNip.toLowerCase().includes(q) ||
        r.note.toLowerCase().includes(q)
    );
  }

  return { records: mapped, today: getTodayJakartaDate() };
}

export async function checkInEmployeeSupabase(
  user: UserProfile,
  status: EmployeeAttendanceStatus,
  note: string
): Promise<EmployeeAttendance> {
  const admin = getSupabaseAdmin();
  const today = getTodayJakartaDate();
  const currentTime = getCurrentJakartaTime();

  const { data: existing } = await admin
    .from('employee_attendance')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle();

  if (existing) {
    throw new Error('Anda sudah melakukan absen masuk hari ini.');
  }

  let finalStatus: EmployeeAttendanceStatus = status;
  if (status === 'Hadir' && currentTime > '07:30:00') {
    finalStatus = 'Terlambat';
  }
  const isPresent = finalStatus === 'Hadir' || finalStatus === 'Terlambat';

  const { data, error } = await admin
    .from('employee_attendance')
    .insert({
      user_id: user.id,
      date: today,
      check_in_time: isPresent ? currentTime : null,
      check_out_time: null,
      status: finalStatus,
      note:
        note ||
        (finalStatus === 'Terlambat' ? 'Absen masuk melewati pukul 07:30' : 'Absen masuk mandiri'),
      updated_at: new Date().toISOString(),
    })
    .select('*, profiles(nama, role, nip)')
    .single();

  if (error || !data) throw new Error(error?.message || 'Gagal mencatat absen masuk.');
  return mapEmployeeAttendance(data as unknown as EmployeeAttendanceJoinedRow);
}

export async function checkOutEmployeeSupabase(
  user: UserProfile,
  note: string
): Promise<EmployeeAttendance> {
  const admin = getSupabaseAdmin();
  const today = getTodayJakartaDate();
  const currentTime = getCurrentJakartaTime();

  const { data: existing, error: findErr } = await admin
    .from('employee_attendance')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle();

  if (findErr || !existing) {
    throw new Error('Anda belum mencatat absen masuk hari ini.');
  }
  if (existing.status === 'Izin' || existing.status === 'Sakit') {
    throw new Error('Absen pulang tidak diperlukan untuk status Izin atau Sakit.');
  }
  if (existing.check_out_time) {
    throw new Error('Anda sudah mencatat absen pulang hari ini.');
  }

  const { data, error } = await admin
    .from('employee_attendance')
    .update({
      check_out_time: currentTime,
      ...(note ? { note } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select('*, profiles(nama, role, nip)')
    .single();

  if (error || !data) throw new Error(error?.message || 'Gagal mencatat absen pulang.');
  return mapEmployeeAttendance(data as unknown as EmployeeAttendanceJoinedRow);
}

export async function getStudentsSupabase(filters: {
  jurusan?: string;
  kelas?: string;
  search?: string;
}): Promise<Student[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from('students')
    .select('*')
    .order('kelas', { ascending: true })
    .order('nama', { ascending: true });

  if (filters.jurusan && filters.jurusan !== 'ALL') {
    query = query.eq('jurusan', filters.jurusan);
  }
  if (filters.kelas && filters.kelas !== 'ALL') {
    query = query.eq('kelas', filters.kelas);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let students = ((data || []) as StudentRow[]).map(mapStudent);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    students = students.filter(
      (s) =>
        s.nama.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q) ||
        s.kelas.toLowerCase().includes(q)
    );
  }
  return students;
}

export async function createStudentSupabase(input: {
  nis: string;
  nama: string;
  kelas: string;
  jurusan: MajorCode;
}): Promise<Student> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('students')
    .insert(input)
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Gagal menambahkan data siswa.');
  return mapStudent(data as StudentRow);
}

export async function updateStudentSupabase(
  id: string,
  input: { nis: string; nama: string; kelas: string; jurusan: MajorCode }
): Promise<Student> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('students')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Gagal memperbarui data siswa.');
  return mapStudent(data as StudentRow);
}

export async function deleteStudentSupabase(id: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('students').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getStudentAttendanceSupabase(filters: {
  date?: string;
  startDate?: string;
  endDate?: string;
  jurusan?: string;
  kelas?: string;
  status?: string;
  search?: string;
}): Promise<{ records: StudentAttendance[]; today: string }> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from('student_attendance')
    .select('*, students(nis, nama, kelas, jurusan), recorder:profiles!recorded_by(nama)')
    .order('date', { ascending: false });

  if (filters.date) query = query.eq('date', filters.date);
  if (filters.startDate) query = query.gte('date', filters.startDate);
  if (filters.endDate) query = query.lte('date', filters.endDate);
  if (filters.status && filters.status !== 'ALL') query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let records = ((data || []) as unknown as StudentAttendanceJoinedRow[]).map(mapStudentAttendance);
  if (filters.jurusan && filters.jurusan !== 'ALL') {
    records = records.filter((r) => r.jurusan === filters.jurusan);
  }
  if (filters.kelas && filters.kelas !== 'ALL') {
    records = records.filter((r) => r.kelas === filters.kelas);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    records = records.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.nis.toLowerCase().includes(q) ||
        r.kelas.toLowerCase().includes(q)
    );
  }

  return { records, today: getTodayJakartaDate() };
}

export async function bulkSaveStudentAttendanceSupabase(
  recorder: UserProfile,
  date: string,
  items: Array<{ studentId: string; status: StudentAttendanceStatus; note: string }>
): Promise<number> {
  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const payload = items.map((item) => ({
    student_id: item.studentId,
    recorded_by: recorder.id,
    date,
    status: item.status,
    note: item.note || '',
    updated_at: nowIso,
  }));

  const { error } = await admin
    .from('student_attendance')
    .upsert(payload, { onConflict: 'student_id,date' });

  if (error) throw new Error(error.message);
  return payload.length;
}

export async function listUsersSupabase(): Promise<UserProfile[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .order('nama', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data || []) as ProfileRow[]).map(mapProfile);
}

export async function createUserSupabase(input: {
  nama: string;
  email: string;
  password: string;
  role: Role;
  nip: string;
  jabatan: string;
}): Promise<UserProfile> {
  const admin = getSupabaseAdmin();
  const resolvedJabatan =
    input.jabatan ||
    (input.role === 'admin'
      ? 'Administrator'
      : input.role === 'guru'
        ? 'Guru Mata Pelajaran'
        : 'Tenaga Kependidikan');

  let createdUserId = '';
  if (hasAdminPrivileges()) {
    const rawAdmin = getSupabaseRawAdmin();
    const { data: created, error: authErr } = await rawAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        nama: input.nama,
        role: input.role,
        nip: input.nip,
        jabatan: resolvedJabatan,
      },
    });

    if (authErr || !created.user) {
      throw new Error(authErr?.message || 'Gagal membuat user di Supabase Auth.');
    }
    createdUserId = created.user.id;
  } else {
    const auth = getSupabaseAuth();
    const { data: signUpData, error: signUpErr } = await auth.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          nama: input.nama,
          role: input.role,
          nip: input.nip,
          jabatan: resolvedJabatan,
        },
      },
    });
    if (signUpErr || !signUpData.user) {
      throw new Error(signUpErr?.message || 'Gagal membuat user di Supabase Auth.');
    }
    createdUserId = signUpData.user.id;
  }

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .upsert({
      id: createdUserId,
      nama: input.nama,
      email: input.email,
      role: input.role,
      nip: input.nip || '-',
      jabatan: resolvedJabatan,
    })
    .select('*')
    .single();

  if (profErr || !profile) {
    throw new Error(profErr?.message || 'Gagal menyinkronkan profil user.');
  }

  return mapProfile(profile as ProfileRow);
}

export async function updateUserSupabase(
  id: string,
  input: {
    nama: string;
    email: string;
    role: Role;
    nip: string;
    jabatan: string;
    password?: string;
  }
): Promise<UserProfile> {
  const admin = getSupabaseAdmin();
  if (hasAdminPrivileges()) {
    const rawAdmin = getSupabaseRawAdmin();
    const { error: authErr } = await rawAdmin.auth.admin.updateUserById(id, {
      email: input.email,
      ...(input.password ? { password: input.password } : {}),
      user_metadata: {
        nama: input.nama,
        role: input.role,
        nip: input.nip,
        jabatan: input.jabatan,
      },
    });

    if (authErr) {
      throw new Error(authErr.message);
    }
  } else if (input.password) {
    throw new Error(
      'Mengubah kata sandi pengguna lain memerlukan Secret key (sb_secret_... / service_role) pada SUPABASE_SERVICE_ROLE_KEY di Secrets.'
    );
  }

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .update({
      nama: input.nama,
      email: input.email,
      role: input.role,
      nip: input.nip || '-',
      jabatan: input.jabatan,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (profErr || !profile) {
    throw new Error(profErr?.message || 'Gagal memperbarui profil user.');
  }

  return mapProfile(profile as ProfileRow);
}

export async function hardDeleteUserSupabase(id: string): Promise<void> {
  if (!hasAdminPrivileges()) {
    throw new Error(
      'Hard delete ke Supabase Authentication memerlukan Secret key (sb_secret_... / service_role) pada SUPABASE_SERVICE_ROLE_KEY di Secrets.'
    );
  }
  const rawAdmin = getSupabaseRawAdmin();
  // Hard delete from Supabase Authentication; ON DELETE CASCADE removes profile & employee_attendance
  const { error } = await rawAdmin.auth.admin.deleteUser(id);
  if (error) {
    throw new Error(error.message);
  }
}
