-- Esquema de respaldo en la nube (Supabase). La app funciona completa sin esto:
-- el teléfono es la fuente de verdad y la nube será el respaldo y el puente entre dispositivos.
--
-- Regla de seguridad: cada fisio solo ve y toca sus propias filas (fisio_id = auth.uid()).
-- Correr completo en el SQL Editor de Supabase. Es seguro volver a correrlo.
--
-- Los ids locales (enteros de SQLite) no sirven entre teléfonos; en la nube cada fila lleva
-- un uuid propio y guarda local_id para emparejarla con la base del teléfono.

create extension if not exists pgcrypto;

create table if not exists public.paciente (
  id uuid primary key default gen_random_uuid(),
  fisio_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_id bigint,
  nombre text not null,
  telefono text not null default '',
  lugar text not null default 'consultorio' check (lugar in ('consultorio','domicilio')),
  direccion text not null default '',
  nacimiento date,
  sexo text not null default '',
  ocupacion text not null default '',
  correo text not null default '',
  emergencia text not null default '',
  patologicos text not null default '',
  quirurgicos text not null default '',
  medicamentos text not null default '',
  alergias text not null default '',
  actividad text not null default '',
  motivo text not null default '',
  inicio text not null default '',
  dx_fisio text not null default '',
  dx_medico text not null default '',
  refiere text not null default '',
  objetivos text not null default '',
  rfc text not null default '',
  regimen text not null default '',
  consentimiento_at timestamptz, -- cuándo firmó el aviso de privacidad (datos de salud = datos sensibles)
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  borrado timestamptz,
  unique (fisio_id, local_id)
);

create table if not exists public.cita (
  id uuid primary key default gen_random_uuid(),
  fisio_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_id bigint,
  paciente_id uuid not null references public.paciente(id) on delete cascade,
  fecha date not null,
  hora time not null,
  duracion_min int not null default 60,
  lugar text not null check (lugar in ('consultorio','domicilio')),
  direccion text not null default '',
  estado text not null default 'agendada' check (estado in ('agendada','confirmada','atendida','cancelada','no_llego')),
  recordatorio_enviado boolean not null default false,
  calendar_event_id text,
  actualizado timestamptz not null default now(),
  borrado timestamptz,
  unique (fisio_id, local_id)
);
create index if not exists cita_fisio_fecha on public.cita (fisio_id, fecha);

create table if not exists public.sesion (
  id uuid primary key default gen_random_uuid(),
  fisio_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_id bigint,
  cita_id uuid references public.cita(id) on delete set null,
  paciente_id uuid not null references public.paciente(id) on delete cascade,
  fecha date not null,
  dolor smallint not null check (dolor between 1 and 10),
  trabajo text not null default '',
  notas text not null default '',
  actualizado timestamptz not null default now(),
  borrado timestamptz,
  unique (fisio_id, local_id)
);

create table if not exists public.paquete (
  id uuid primary key default gen_random_uuid(),
  fisio_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_id bigint,
  paciente_id uuid not null references public.paciente(id) on delete cascade,
  sesiones int not null check (sesiones > 0),
  usadas int not null default 0 check (usadas >= 0),
  precio numeric(12,2) not null default 0,
  fecha date not null,
  actualizado timestamptz not null default now(),
  borrado timestamptz,
  unique (fisio_id, local_id)
);

create table if not exists public.cobro (
  id uuid primary key default gen_random_uuid(),
  fisio_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_id bigint,
  paciente_id uuid not null references public.paciente(id) on delete cascade,
  cita_id uuid references public.cita(id) on delete set null,
  paquete_id uuid references public.paquete(id) on delete set null,
  fecha date not null,
  monto numeric(12,2) not null default 0,
  metodo text not null check (metodo in ('efectivo','transferencia','tarjeta','paquete')),
  lugar text not null check (lugar in ('consultorio','domicilio')),
  factura boolean not null default false,
  concepto text not null default '',
  actualizado timestamptz not null default now(),
  borrado timestamptz,
  unique (fisio_id, local_id)
);
create index if not exists cobro_fisio_fecha on public.cobro (fisio_id, fecha);

create table if not exists public.ajuste (
  fisio_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clave text not null,
  valor text not null,
  primary key (fisio_id, clave)
);

-- actualizado se mantiene solo
create or replace function public.tocar_actualizado() returns trigger language plpgsql as $$
begin new.actualizado := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['paciente','cita','sesion','paquete','cobro'] loop
    execute format('drop trigger if exists %1$s_actualizado on public.%1$s', t);
    execute format('create trigger %1$s_actualizado before update on public.%1$s for each row execute function public.tocar_actualizado()', t);
  end loop;
end $$;

-- Seguridad por fila: cada quien lo suyo, nada más.
do $$
declare t text;
begin
  foreach t in array array['paciente','cita','sesion','paquete','cobro','ajuste'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists solo_lo_mio on public.%I', t);
    execute format(
      'create policy solo_lo_mio on public.%I for all to authenticated using (fisio_id = (select auth.uid())) with check (fisio_id = (select auth.uid()))',
      t);
  end loop;
end $$;
