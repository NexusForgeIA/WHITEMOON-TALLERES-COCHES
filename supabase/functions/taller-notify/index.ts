import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// taller-notify — notifica por WhatsApp un nuevo lead del chatbot del taller (demo).
// Mantiene la CALLMEBOT_APIKEY EXCLUSIVAMENTE server-side. Mismo patron que banzai-notify/alejandr-notify.
//
// La CALLMEBOT_APIKEY del proyecto esta vinculada al numero de Cristobal (WhiteMoon),
// por eso el aviso se entrega a WA_NUMBER (34643199580 por defecto).
//
// Recibe (POST JSON): { nombre, telefono, matricula, modelo, servicio, sintoma, fecha, hora, urgente, origen }

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
  const nombre = String(data.nombre ?? "").trim() || "-";
  const telefono = String(data.telefono ?? "").trim() || "-";
  const matricula = String(data.matricula ?? "").trim() || "-";
  const modelo = String(data.modelo ?? "").trim();
  const servicio = String(data.servicio ?? "").trim() || "-";
  const sintoma = String(data.sintoma ?? "").trim();
  const fecha = String(data.fecha ?? "").trim();
  const hora = String(data.hora ?? "").trim();
  const urgente = Boolean(data.urgente);

  const prefix = urgente ? "AVERIA URGENTE - TALLER" : "LEAD TALLER";

  let message = `${prefix}\n` +
    `Nombre: ${nombre}\n` +
    `Telefono: ${telefono}\n` +
    `Matricula: ${matricula}\n` +
    `Servicio: ${servicio}`;

  if (modelo) message += `\nVehiculo: ${modelo}`;
  if (sintoma) message += `\nSintoma: ${sintoma}`;
  if (fecha) message += `\nFecha solicitada: ${fecha}`;
  if (hora) message += `\nHora solicitada: ${hora}`;

  const waNumber = Deno.env.get("WA_NUMBER") ?? "34643199580";

  let notified = false;
  try {
    const callmebotKey = Deno.env.get("CALLMEBOT_APIKEY");
    if (callmebotKey) {
      const notifyUrl =
        `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(waNumber)}` +
        `&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(callmebotKey)}`;
      const r = await fetch(notifyUrl);
      notified = r.ok;
      if (!r.ok) {
        console.warn("[taller-notify] CallMeBot fallo:", r.status, await r.text());
      }
    } else {
      console.warn("[taller-notify] sin CALLMEBOT_APIKEY, mensaje:", message);
    }
  } catch (e) {
    console.warn("[taller-notify] error enviando WhatsApp:", e);
  }

  return json({ ok: true, notified });
});
