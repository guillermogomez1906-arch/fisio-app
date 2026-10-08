-- Respaldo en la nube (Supabase). Correr completo en el SQL Editor del proyecto.
--
-- El teléfono es la fuente de verdad y funciona sin señal; la nube guarda una copia por cuenta
-- para no perder nada y para restaurar en otro teléfono.
--
-- Reglas:
--  * Cada fila trae su id (uuid) desde el teléfono; es el mismo en todos los teléfonos de la cuenta.
--  * "actualizado" lo pone el servidor en cada alta o cambio; el teléfono baja lo nuevo con eso.
--  * Los borrados no se eliminan: se marca "borrado" para que los demás teléfonos se enteren.
--  * Seguridad por fila: cada fisio solo ve y toca lo suyo (fisio_id = auth.uid()).
--
-- La historia clínica son datos de salud (datos sensibles en la LFPDPPP). Nunca uses la llave
-- secreta (service_role) en la app: solo la publicable.

create table if not exists public.paciente (
  id uuid primary key,
  fisio_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
  actualizado timestamptz not null default now(),
  borrado timestamptz
);

create table if not exists public.cita (
  id uuid primary key,
  fisio_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
  borrado timestamptz
);

create table if not exists public.paquete (
  id uuid primary key,
  fisio_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  paciente_id uuid not null references public.paciente(id) on delete cascade,
  sesiones int not null check (sesiones > 0),
  usadas int not null default 0 check (usadas >= 0),
  precio numeric(12,2) not null default 0,
  fecha date not null,
  actualizado timestamptz not null default now(),
  borrado timestamptz
);

create table if not exists public.sesion (
  id uuid primary key,
  fisio_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  paciente_id uuid not null references public.paciente(id) on delete cascade,
  cita_id uuid references public.cita(id) on delete set null,
  fecha date not null,
  dolor smallint not null check (dolor between 1 and 10),
  trabajo text not null default '',
  notas text not null default '',
  actualizado timestamptz not null default now(),
  borrado timestamptz
);

create table if not exists public.cobro (
  id uuid primary key,
  fisio_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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
  borrado timestamptz
);

create table if not exists public.ajuste (
  fisio_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clave text not null,
  valor text not null,
  actualizado timestamptz not null default now(),
  primary key (fisio_id, clave)
);

-- "actualizado" siempre lo pone el servidor. clock_timestamp() (y no now()) para que dos cambios
-- en la misma transacción no compartan la marca.
create or replace function public.marcar_actualizado() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado := clock_timestamp();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['paciente','cita','paquete','sesion','cobro','ajuste'] loop
    execute format('drop trigger if exists %1$s_actualizado on public.%1$I', t);
    execute format('create trigger %1$s_actualizado before insert or update on public.%1$I for each row execute function public.marcar_actualizado()', t);
    execute format('create index if not exists %1$s_fisio_actualizado on public.%1$I (fisio_id, actualizado)', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists solo_lo_mio on public.%I', t);
    execute format(
      'create policy solo_lo_mio on public.%I for all to authenticated using (fisio_id = (select auth.uid())) with check (fisio_id = (select auth.uid()))',
      t);
  end loop;
end $$;
