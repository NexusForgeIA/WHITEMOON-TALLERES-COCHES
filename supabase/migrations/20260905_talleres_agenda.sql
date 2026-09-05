-- =====================================================================
-- Agenda de la demo Taller Ejemplo (WhiteMoon · sector automoción).
--
-- Espeja tabla a tabla el esquema de la demo de yoga (_yoga), con el
-- vocabulario del sector: la columna `servicio` guarda el nombre del
-- servicio del taller (Cambio de aceite, Revisión general, Pre-ITV,
-- Neumáticos, Frenos, Diagnosis electrónica, Aire acondicionado).
--
-- RLS: igual que en _yoga — activada y SIN ninguna policy. Nadie que
-- llegue con la clave publicable puede leer ni escribir; la única vía es la
-- Edge Function `talleres-cita`, que usa la service role y salta RLS. El
-- chat de la web no toca estas tablas: solo INSERTa en leads_web.
-- =====================================================================

-- ---------- CLIENTES ----------
create table if not exists public.clientes_taller (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  nombre        text not null,
  telefono      text not null,
  telefono_norm text not null,
  notas         text,
  updated_at    timestamptz not null default now()
);
-- Clave de teléfono: los últimos 9 dígitos. Quien reserva como "600 123 456"
-- y luego busca su cita como "+34 600123456" es la misma persona.
create unique index if not exists clientes_taller_tel_norm_idx
  on public.clientes_taller (telefono_norm);

-- ---------- CITAS ----------
create table if not exists public.citas_taller (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  cliente_nombre   text not null,
  cliente_telefono text not null,
  cliente_id       uuid references public.clientes_taller(id) on delete set null,
  servicio         text not null,
  duracion_min     integer not null default 60,
  cita_at          timestamptz not null,
  estado           text not null default 'agendada',
  resena_enviada   boolean not null default false,
  notas            text,
  origen           text not null default 'chatbot',
  -- Columna generada: los últimos 9 dígitos del teléfono. Es lo que usan
  -- buscar-cita / cancelar-cita / reprogramar-cita para resolver la cita
  -- por número sin que el visitante escriba nada más en el chat.
  cliente_telefono_norm text generated always as
    (right(regexp_replace(cliente_telefono, '\D', '', 'g'), 9)) stored
);
create index if not exists citas_taller_cita_at_idx  on public.citas_taller (cita_at);
create index if not exists citas_taller_cliente_idx  on public.citas_taller (cliente_id);
create index if not exists citas_taller_tel_norm_idx on public.citas_taller (cliente_telefono_norm, cita_at);

-- ---------- LOG ----------
create table if not exists public.citas_taller_log (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cita_id    uuid,
  accion     text not null,
  detalle    text
);

-- ---------- SERVICIOS (catálogo con precio y duración) ----------
create table if not exists public.servicios_taller (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null unique,
  duracion_min integer not null default 60,
  precio_eur   numeric not null default 0,
  activo       boolean not null default true,
  orden        integer not null default 0,
  updated_at   timestamptz not null default now()
);

-- ---------- CONFIG DEL TALLER ----------
create table if not exists public.taller_config (
  id             smallint primary key default 1,
  taller_nombre  text not null default '',
  gerente_nombre text not null default '',
  wa_number      text not null default '',
  gmb_url        text not null default '',
  updated_at     timestamptz not null default now()
);

-- ---------- VISTA DE RESUMEN DE CLIENTES ----------
-- security_invoker NO es opcional: sin él la vista se evalúa con los permisos
-- de su propietario (postgres) y se salta la RLS de clientes_taller, así que
-- cualquiera con la clave publicable —que va en el HTML— podría leer el nombre
-- y el teléfono de todos los clientes. Con security_invoker la vista usa los
-- permisos de quien consulta: anon no ve nada y la service role, que salta RLS,
-- sigue funcionando igual para el panel.
create or replace view public.clientes_taller_resumen
  with (security_invoker = on) as
  select c.id,
         c.nombre,
         c.telefono,
         c.notas,
         c.created_at,
         count(t.id)     as n_citas,
         max(t.cita_at)  as ultima_cita
    from public.clientes_taller c
    left join public.citas_taller t
      on t.cliente_id = c.id and t.estado <> 'cancelada'
   group by c.id;

-- ---------- RLS ----------
alter table public.clientes_taller  enable row level security;
alter table public.citas_taller     enable row level security;
alter table public.citas_taller_log enable row level security;
alter table public.servicios_taller enable row level security;
alter table public.taller_config    enable row level security;

-- Cinturón y tirantes: la vista tampoco se concede a los roles públicos.
revoke all on public.clientes_taller_resumen from anon, authenticated;

-- ---------- SEMILLA ----------
insert into public.taller_config (id, taller_nombre, gerente_nombre)
values (1, 'Taller Ejemplo', '')
on conflict (id) do nothing;

-- Precios orientativos de demo, no una tarifa real.
insert into public.servicios_taller (nombre, duracion_min, precio_eur, orden) values
  ('Cambio de aceite',       45, 49, 1),
  ('Revisión general',       60, 89, 2),
  ('Pre-ITV',                45, 39, 3),
  ('Neumáticos',             45, 59, 4),
  ('Frenos',                120, 99, 5),
  ('Diagnosis electrónica',  60, 45, 6),
  ('Aire acondicionado',     60, 55, 7)
on conflict (nombre) do nothing;
