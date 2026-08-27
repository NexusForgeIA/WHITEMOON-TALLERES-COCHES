import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// talleres-notify — notifica por Telegram un nuevo lead de la demo de talleres.
// El lead ya se inserta en leads_web desde el cliente (origen='demo-talleres',
// sector='automocion'); esta funcion SOLO envia la notificacion via Telegram Bot
// API, manteniendo el token EXCLUSIVAMENTE server-side. Regla fija del proyecto:
// TODA demo con agente IA avisa por Telegram. Mismo patron que reformas-notify.
//
// Secrets del proyecto (Supabase -> Edge Functions -> Secrets):
//   TELEGRAM_BOT_TOKEN  — token del bot de Telegram
//   TELEGRAM_CHAT_ID    — chat destino del aviso
//
// verify_jwt: false (se llama desde el navegador sin sesion; no expone secretos).
//
// Recibe (POST JSON): { taller, nombre, telefono, servicio, cita_dia, cita_hora, origen }
//
// El cliente puede llamar por sendBeacon con Content-Type text/plain: aqui se
// parsea con req.json() sin mirar el Content-Type, asi el beacon sigue siendo
// una peticion simple y no dispara preflight CORS.

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

  // Guard de lead incompleto — estandar WhiteMoon.
  // Un lead solo es valido con nombre Y telefono: sin ambos no se avisa.
  if (!nombre || !telefono) {
    return json({ ok: false, error: "lead incompleto" }, 400);
  }

  const servicio = String(data.servicio ?? "").trim() || "-";
  const origen = String(data.origen ?? "demo-talleres").trim() || "-";
  const citaDia = String(data.cita_dia ?? "").trim();
  const citaHora = String(data.cita_hora ?? "").trim();

  // La cita es opcional: el lead puede cerrarse sin pasar por la agenda.
  const cita = (citaDia || citaHora)
    ? `\nCita: ${citaDia || "-"}${citaHora ? " a las " + citaHora : ""}`
    : "";

  const message =
    `Nuevo lead ${taller} (demo)\n` +
    `Servicio: ${servicio}\n` +
    `Nombre: ${nombre}\n` +
    `Telefono: ${telefono}` + cita + `\n` +
    `Origen: ${origen}`;

  let notified = false;
  try {
    const tgToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const tgChat = Deno.env.get("TELEGRAM_CHAT_ID");
    if (tgToken && tgChat) {
      const r = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tgChat, text: message }),
      });
      notified = r.ok;
      if (!r.ok) {
        console.warn("[talleres-notify] Telegram fallo:", r.status, await r.text());
      }
    } else {
      console.warn("[talleres-notify] sin TELEGRAM_BOT_TOKEN/CHAT_ID, mensaje:", message);
    }
  } catch (e) {
    console.warn("[talleres-notify] error enviando Telegram:", e);
  }

  return json({ ok: true, notified });
});
