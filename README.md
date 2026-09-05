# WHITEMOON-TALLERES-COCHES

Demo comercial de WhiteMoon Agencia IA para el sector de talleres de coches.
«Taller Ejemplo» es un taller ficticio: sus datos y precios son ilustrativos.

Web: https://nexusforgeia.github.io/WHITEMOON-TALLERES-COCHES/

## Qué hay aquí

| Fichero | Qué es |
| --- | --- |
| `index.html` | La web pública. Tema negro, gris y dorado. |
| `agenda.html` | Panel privado del taller (agenda, clientes, servicios, estadísticas, perfil). Entra con clave, `noindex`. |
| `assets/js/leo.js` | Leo, el agente IA: pide cita, y cambia o cancela una ya hecha. |
| `assets/js/main.js` | Interacciones de la web. Sin librerías externas. |
| `assets/css/style.css` | Hoja de estilos única, con la paleta y los contrastes documentados. |
| `supabase/migrations/` | Esquema de la agenda (`*_taller`). |
| `supabase/functions/talleres-cita/` | Backend de la agenda: huecos, citas y autogestión. |
| `supabase/functions/talleres-notify/` | Aviso por Telegram de un lead **sin** cita. |

## Cómo funciona una cita

1. Leo pregunta el servicio, cuenta en qué consiste y pide **nombre y teléfono**.
   El contacto va antes del calendario a propósito: si alguien abandona
   eligiendo el día, el lead ya está completo.
2. Con los datos, pide los huecos reales a `talleres-cita` (`huecos`). No se
   inventa ninguna franja en el navegador.
3. Al elegir hora se llama a `reservar`: la cita se escribe en `citas_taller` y
   aparece en `agenda.html`.
4. El lead se guarda **siempre** en `leads_web` con `origen='demo-taller'`, que
   es la fila que lee Scout en tiempo real.

### Un solo Telegram por evento

- Con cita reservada → avisa `talleres-cita` con su «🔧 NUEVA CITA».
- Sin cita (salida sin franja, «prefiero que me llaméis» o la agenda caída) →
  avisa `talleres-notify` con el lead.

Nunca salen dos mensajes por la misma solicitud.

## Autogestión sin `cita_id`

Desde el chat se puede cambiar o cancelar una cita. El servidor la resuelve por
el teléfono y exige acertar el nombre con el que se reservó; el `cita_id` no
sale nunca al navegador, así que no hay forma de llamar desde la web a las
acciones del panel, que no comprueban identidad.

## Seguridad

- RLS activada y **sin policies** en todas las tablas `*_taller`: con la clave
  publicable no se puede leer ni escribir. La única vía es la Edge Function con
  la service role.
- La vista `clientes_taller_resumen` va con `security_invoker = on`. Sin eso una
  vista se evalúa con los permisos de su propietario y **se salta la RLS de la
  tabla que consulta**: cualquiera con la clave publicable podría listar nombre y
  teléfono de todos los clientes. Comprobado con la clave publicable: la tabla
  devuelve vacío y la vista responde `42501 permission denied`.
- La clave publicable del cliente solo puede INSERT en `leads_web`.
- El token del bot de Telegram vive en los Secrets de Supabase, nunca en el
  repositorio ni en el navegador.

## Horario de la agenda

Lunes a viernes de 8:00 a 14:00 y de 16:00 a 19:00; sábado de 9:00 a 14:00;
domingo cerrado. Huecos cada 30 minutos, con una hora de margen mínimo para
reservar. Las fechas se formatean en el servidor en `Europe/Madrid`.

## Desplegar el backend

```bash
supabase functions deploy talleres-cita   --no-verify-jwt --project-ref mlaqtniujnvfxcvcourm
supabase functions deploy talleres-notify --no-verify-jwt --project-ref mlaqtniujnvfxcvcourm
```

Secrets necesarios: `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`.

## Rendimiento

Sin librerías externas ni Google Fonts: Sora va auto-hospedada como una sola
fuente variable (dos ficheros que son subsets por `unicode-range`, no copias por
peso). El reveal usa `IntersectionObserver`, el scroll-spy cachea las medidas y
solo escribe en el DOM al cambiar de sección, y el vídeo del hero no se carga en
móvil ni con `prefers-reduced-motion`.
