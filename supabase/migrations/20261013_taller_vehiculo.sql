-- =====================================================================
-- Datos del vehículo en la cita del taller (marca, modelo, matrícula).
--
-- Van en la CITA y no en el cliente: una misma persona trae coches
-- distintos (el suyo, el de su pareja) y el historial tiene que decir con
-- cuál vino. Columnas nulas: las citas anteriores no tienen vehículo.
-- La matrícula se guarda normalizada (mayúsculas, sin espacios ni guiones)
-- por la Edge Function `talleres-cita`; aquí solo se indexa.
--
-- RLS sin cambios: la tabla sigue sin policies, solo accede la service role.
-- =====================================================================
alter table public.citas_taller
  add column if not exists marca     text,
  add column if not exists modelo    text,
  add column if not exists matricula text;

create index if not exists citas_taller_matricula_idx
  on public.citas_taller (matricula);
