async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function latestConfig(db: any) {
  const { data } = await db
    .from("bot_config")
    .select("id, admin_status, whatsapp_enabled, whatsapp_country_code, whatsapp_number, whatsapp_webhook_url")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Server-only helper: fires the n8n WhatsApp webhook when admin is Away. */
export async function routeHandoffToWhatsApp(sessionId: string) {
  try {
    const db = await admin();
    const c = await latestConfig(db);
    if (!c || c.admin_status !== "away" || !c.whatsapp_enabled || !c.whatsapp_webhook_url) return false;
    const [{ data: chat }, { data: msgs }] = await Promise.all([
      db.from("chats").select("session_number, user_language, handoff_username, handoff_topic, handoff_queries").eq("id", sessionId).maybeSingle(),
      db.from("messages").select("content, created_at").eq("chat_id", sessionId).eq("sender", "user").order("created_at", { ascending: false }).limit(1),
    ]);
    const n = chat?.session_number;
    const res = await fetch(c.whatsapp_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "human_handoff",
        sessionId: typeof n === "number" ? `NS${String(n).padStart(4, "0")}` : sessionId,
        sessionUuid: sessionId,
        userMessage: msgs?.[0]?.content ?? "",
        clientDetails: {
          name: chat?.handoff_username ?? null,
          topic: chat?.handoff_topic ?? null,
          queries: chat?.handoff_queries ?? null,
          language: chat?.user_language ?? null,
        },
        adminWhatsApp: `${c.whatsapp_country_code}${c.whatsapp_number ?? ""}`,
        timestamp: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      console.error(`[whatsapp] webhook failed [${res.status}]: ${await res.text()}`);
      return false;
    }
    await db.from("chats").update({ whatsapp_routed: true }).eq("id", sessionId);
    return true;
  } catch (e) {
    console.error("[whatsapp] webhook error", e);
    return false;
  }
}
