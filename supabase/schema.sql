-- =============================================================================
-- SMK Prima Unggul — Skema Database Relasional Supabase (PostgreSQL + RLS)
-- Versi 2: Normalisasi tabel jurusan (majors), relasi penuh, trigger & RLS.
-- Jalankan seluruh skrip ini pada Supabase SQL Editor.
-- =============================================================================

create extension if not exists "pgcrypto";

-- 1. Tabel Referensi Jurusan / Kompetensi Keahlian
create table if not exists public.majors (
  code text primary key check (code in ('TKJ', 'DKV', 'AK', 'BC', 'MPLB', 'BD')),
  name text not null,
  cluster text not null
);

insert into public.majors (code, name, cluster) values
  ('TKJ', 'Teknik Komputer dan Jaringan', 'Teknologi Informasi & Media Kreatif'),
  ('DKV', 'Desain Komunikasi Visual', 'Teknologi Informasi & Media Kreatif'),
  ('BC', 'Broadcasting dan Perfilman', 'Teknologi Informasi & Media Kreatif'),
  ('AK', 'Akuntansi dan Keuangan Lembaga', 'Keuangan & Akuntansi'),
  ('MPLB', 'Manajemen Perkantoran dan Layanan Bisnis', 'Manajemen & Niaga Digital'),
  ('BD', 'Bisnis Digital', 'Manajemen & Niaga Digital')
on conflict (code) do update
set
  name = excluded.name,
  cluster = excluded.cluster;

-- 2. Tabel Profil Pengguna (Berelasi 1-to-1 dengan auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nama text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'guru', 'tenaga_kependidikan')),
  nip text not null default '-',
  jabatan text not null default 'Karyawan Sekolah',
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles (role);

-- 3. Trigger Otomatis: User Pertama di Supabase Auth Menjadi Admin
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count integer;
  assigned_role text;
  meta_role text;
begin
  perform pg_advisory_xact_lock(hashtext('smk_prima_unggul_first_admin'));

  select count(*) into existing_count from public.profiles;
  meta_role := coalesce(new.raw_user_meta_data ->> 'role', '');

  if existing_count = 0 then
    assigned_role := 'admin';
  elsif meta_role in ('admin', 'guru', 'tenaga_kependidikan') then
    assigned_role := meta_role;
  else
    assigned_role := 'tenaga_kependidikan';
  end if;

  insert into public.profiles (id, nama, email, role, nip, jabatan)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nama'), ''), split_part(new.email, '@', 1)),
    new.email,
    assigned_role,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nip'), ''), '-'),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'jabatan'), ''),
      case assigned_role
        when 'admin' then 'Administrator Sistem'
        when 'guru' then 'Guru Mata Pelajaran'
        else 'Tenaga Kependidikan'
      end
    )
  )
  on conflict (id) do update
  set
    nama = excluded.nama,
    email = excluded.email,
    role = excluded.role,
    nip = excluded.nip,
    jabatan = excluded.jabatan;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Tabel Master Siswa (Berelasi ke public.majors)
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique,
  nama text not null,
  kelas text not null,
  jurusan text not null references public.majors (code) on update cascade,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_students_jurusan'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      drop constraint if exists students_jurusan_check;
    alter table public.students
      add constraint fk_students_jurusan
      foreign key (jurusan) references public.majors (code) on update cascade;
  end if;
exception
  when duplicate_object then null;
end;
$$;

create index if not exists idx_students_jurusan_kelas on public.students (jurusan, kelas);

-- 5. Tabel Absensi Karyawan (Berelasi ke public.profiles)
create table if not exists public.employee_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  check_in_time time,
  check_out_time time,
  status text not null check (status in ('Hadir', 'Terlambat', 'Izin', 'Sakit')),
  note text not null default '',
  updated_at timestamptz not null default now(),
  constraint uq_employee_attendance_user_date unique (user_id, date)
);

create index if not exists idx_employee_attendance_date on public.employee_attendance (date desc);
create index if not exists idx_employee_attendance_user on public.employee_attendance (user_id);

-- 6. Tabel Absensi Siswa (Berelasi ke public.students & pencatat public.profiles)
create table if not exists public.student_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  recorded_by uuid references public.profiles (id) on delete set null,
  date date not null,
  status text not null check (status in ('Hadir', 'Sakit', 'Izin', 'Alpha')),
  note text not null default '',
  updated_at timestamptz not null default now(),
  constraint uq_student_attendance_student_date unique (student_id, date)
);

create index if not exists idx_student_attendance_date on public.student_attendance (date desc);
create index if not exists idx_student_attendance_student on public.student_attendance (student_id);
create index if not exists idx_student_attendance_recorder on public.student_attendance (recorded_by);

-- 7. Trigger otomatis pembaruan kolom updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_employee_attendance_updated_at on public.employee_attendance;
create trigger trg_employee_attendance_updated_at
  before update on public.employee_attendance
  for each row execute function public.set_updated_at();

drop trigger if exists trg_student_attendance_updated_at on public.student_attendance;
create trigger trg_student_attendance_updated_at
  before update on public.student_attendance
  for each row execute function public.set_updated_at();

-- 8. Helper Role & Kebijakan Row Level Security (RLS)
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.majors enable row level security;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.employee_attendance enable row level security;
alter table public.student_attendance enable row level security;

drop policy if exists "majors_read_authenticated" on public.majors;
create policy "majors_read_authenticated"
  on public.majors for select
  using (auth.uid() is not null);

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.current_user_role() in ('admin', 'guru'));

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
  on public.profiles for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "students_select_admin_or_guru" on public.students;
create policy "students_select_admin_or_guru"
  on public.students for select
  using (public.current_user_role() in ('admin', 'guru'));

drop policy if exists "students_admin_write" on public.students;
create policy "students_admin_write"
  on public.students for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "emp_att_select_own_or_admin" on public.employee_attendance;
create policy "emp_att_select_own_or_admin"
  on public.employee_attendance for select
  using (user_id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "emp_att_insert_own" on public.employee_attendance;
create policy "emp_att_insert_own"
  on public.employee_attendance for insert
  with check (user_id = auth.uid());

drop policy if exists "emp_att_update_own_or_admin" on public.employee_attendance;
create policy "emp_att_update_own_or_admin"
  on public.employee_attendance for update
  using (user_id = auth.uid() or public.current_user_role() = 'admin')
  with check (user_id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "std_att_select_admin_or_guru" on public.student_attendance;
create policy "std_att_select_admin_or_guru"
  on public.student_attendance for select
  using (public.current_user_role() in ('admin', 'guru'));

drop policy if exists "std_att_write_admin_or_guru" on public.student_attendance;
create policy "std_att_write_admin_or_guru"
  on public.student_attendance for all
  using (public.current_user_role() in ('admin', 'guru'))
  with check (public.current_user_role() in ('admin', 'guru'));

-- 9. Data Awal Siswa 6 Jurusan SMK Prima Unggul (TKJ, DKV, AK, BC, MPLB, BD)
insert into public.students (nis, nama, kelas, jurusan) values
  ('20241001', 'Ahmad Fauzan Pratama', 'X TKJ 1', 'TKJ'),
  ('20241002', 'Nadia Putri Azzahra', 'X TKJ 1', 'TKJ'),
  ('20241003', 'Dimas Arya Saputra', 'XI TKJ 1', 'TKJ'),
  ('20241004', 'Rania Khairunnisa', 'XII TKJ 1', 'TKJ'),
  ('20242001', 'Bagas Prakoso Wibowo', 'X DKV 1', 'DKV'),
  ('20242002', 'Aulia Rahmawati', 'XI DKV 1', 'DKV'),
  ('20242003', 'Keisha Maharani Putri', 'XI DKV 1', 'DKV'),
  ('20242004', 'Fajar Nugroho', 'XII DKV 1', 'DKV'),
  ('20243001', 'Salsa Bila Oktaviani', 'X AK 1', 'AK'),
  ('20243002', 'Muhammad Ilham Akbar', 'XI AK 1', 'AK'),
  ('20243003', 'Tiara Puspitasari', 'XII AK 1', 'AK'),
  ('20243004', 'Naufal Hakim Siregar', 'XII AK 1', 'AK'),
  ('20244001', 'Clarissa Amanda Wijaya', 'X BC 1', 'BC'),
  ('20244002', 'Galih Permana Putra', 'XI BC 1', 'BC'),
  ('20244003', 'Zahra Aliyah Putri', 'XII BC 1', 'BC'),
  ('20245001', 'Intan Permata Sari', 'X MPLB 1', 'MPLB'),
  ('20245002', 'Dinda Ayu Kusuma', 'XI MPLB 1', 'MPLB'),
  ('20245003', 'Reza Pahlevi Mahendra', 'XII MPLB 1', 'MPLB'),
  ('20246001', 'Arif Budiman Santoso', 'X BD 1', 'BD'),
  ('20246002', 'Maya Anggraini', 'XI BD 1', 'BD'),
  ('20246003', 'Kevin Alexander Tan', 'XII BD 1', 'BD')
on conflict (nis) do nothing;
