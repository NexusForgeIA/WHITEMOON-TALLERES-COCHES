import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// talleres-notify — aviso por Telegram de una nueva SOLICITUD DE CITA de la
// demo Taller Ejemplo (asistente "Leo").
//
// El lead ya se inserta en leads_web desde el cliente (origen='demo-taller');
// esta función SOLO envía la notificación vía Telegram Bot API, manteniendo el
// token EXCLUSIVAMENTE server-side.
//
// Recibe (POST): { nombre, telefono, motivo, dia, hora, reservada, origen }
// El cuerpo llega por navigator.sendBeacon como text/plain;charset=UTF-8 —
// un tipo CORS-safelisted, para no disparar un preflight que el beacon no
// sabe hacer. `req.json()` no mira el Content-Type, así que lo parsea igual.
//
// UN SOLO Telegram por evento: `talleres-cita` ya manda su propio
// "🔧 NUEVA CITA" cuando la cita queda escrita en la agenda, así que Leo
// solo llama aquí cuando NO hubo reserva.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const data = (payload.args ?? payload) as Record<string, unknown>;
  const taller = String(data.taller ?? "Taller Ejemplo").trim() || "Taller Ejemplo";
  const nombre = String(data.nombre ?? "").trim();
  const telefono = String(data.telefono ?? "").trim();
  // `motivo` es el nombre nuevo del campo; se acepta `servicio` por si queda
  // alguna pestaña abierta con la versión anterior de la página.
  const motivo = String(data.motivo ?? data.servicio ?? "").trim();
  const dia = String(data.dia ?? data.cita_dia ?? "").trim();
  const hora = String(data.hora ?? data.cita_hora ?? "").trim();
  const origen = String(data.origen ?? "demo-taller").trim() || "demo-taller";
  const reservada = data.reservada === true || data.reservada === "Sí";

  // Guard de lead incompleto — estándar WhiteMoon.
  if (!nombre || !telefono) {
    return json({ ok: false, error: "lead incompleto" }, 400);
  }

  const message =
    `🔧 NUEVA SOLICITUD DE CITA — ${taller} (${origen})\n\n` +
    `👤 ${nombre}\n` +
    `📱 ${telefono}\n` +
    `🛠️ Servicio: ${motivo || "-"}\n` +
    (dia && hora ? `📅 ${dia} a las ${hora}\n` : "📅 Sin franja elegida\n") +
    `\n` +
    (reservada
      ? "✅ Cita YA reservada en la agenda. No hay que llamar para cerrarla.\n"
      : "⚠️ Solo tenemos el lead: hay que llamar para cerrar día y hora.\n") +
    `📲 CONTACTAR: https://wa.me/34${telefono.replace(/\D/g, "")}`;

  let notified = false;
  try {
    const tgToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const tgChat = Deno.env.get("TELEGRAM_CHAT_ID");
    if (tgToken && tgChat) {
      const r = await fetch(
        `https://api.telegram.org/bot${tgToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: tgChat, text: message }),
        },
      );
      notified = r.ok;
      if (!r.ok) {
        console.warn("[talleres-notify] Telegram falló:", r.status, await r.text());
      }
    } else {
      console.warn("[talleres-notify] sin TELEGRAM_BOT_TOKEN/CHAT_ID, mensaje:", message);
    }
  } catch (e) {
    console.warn("[talleres-notify] error enviando Telegram:", e);
  }

  return json({ ok: true, notified });
});
