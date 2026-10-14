-- =====================================================================
-- Estado del coche en el taller: recepcionado -> trabajando -> terminado.
--
-- Va aparte de `estado` (agendada/confirmada/completada...) a propósito:
-- `estado` describe la CITA; `fase_coche` describe dónde está el COCHE
-- ahora mismo, y es lo que el cliente pregunta para no tener que llamar.
-- Nulo = el coche aún no ha entrado en el taller.
--
-- RLS sin cambios: la tabla sigue sin policies, solo accede la service role
-- a través de la Edge Function `talleres-cita`.
-- =====================================================================
alter table public.citas_taller
  add column if not exists fase_coche text,
  add column if not exists fase_at    timestamptz;

alter table public.citas_taller
  drop constraint if exists citas_taller_fase_coche_chk;
alter table public.citas_taller
  add constraint citas_taller_fase_coche_chk
  check (fase_coche is null or fase_coche in ('recepcionado','trabajando','terminado'));
