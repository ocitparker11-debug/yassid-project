import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

function cleanEnv(value: string | undefined): string {
  return value ? value.trim().replace(/^["']|["']$/g, '').trim() : '';
}

const supabaseUrl =
  cleanEnv(process.env.SUPABASE_URL) ||
  cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  cleanEnv(process.env.VITE_SUPABASE_URL);

const serviceRoleKey =
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || cleanEnv(process.env.SUPABASE_SERVICE_KEY);

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Error: SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di environment / Secrets.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const INITIAL_USERS = [
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
] as const;

async function main() {
  console.log('Memulai sinkronisasi akun awal ke Supabase Authentication...');

  const { data: existingList, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    throw new Error(`Gagal membaca Supabase Auth: ${listErr.message}`);
  }

  for (const item of INITIAL_USERS) {
    const existing = existingList.users.find(
      (u) => u.email?.toLowerCase() === item.email.toLowerCase()
    );

    let userId: string;
    if (existing) {
      const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, {
        password: item.password,
        email_confirm: true,
        user_metadata: {
          nama: item.nama,
          role: item.role,
          nip: item.nip,
          jabatan: item.jabatan,
        },
      });
      if (updErr) throw new Error(`Gagal memperbarui ${item.email}: ${updErr.message}`);
      userId = existing.id;
      console.log(`Updated Auth user: ${item.email} (${item.role})`);
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
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
        throw new Error(`Gagal membuat ${item.email}: ${createErr?.message}`);
      }
      userId = created.user.id;
      console.log(`Created Auth user: ${item.email} (${item.role})`);
    }

    const { error: profErr } = await supabase.from('profiles').upsert({
      id: userId,
      nama: item.nama,
      email: item.email,
      role: item.role,
      nip: item.nip,
      jabatan: item.jabatan,
    });
    if (profErr) {
      throw new Error(`Gagal sinkronisasi profil ${item.email}: ${profErr.message}`);
    }
  }

  console.log('Selesai! Akun Admin, Guru, dan Tenaga Kependidikan siap digunakan untuk login.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
