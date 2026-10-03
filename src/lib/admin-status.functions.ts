import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const [{ data: a }, { data: s }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "staff" }),
  ]);
  if (!a && !s) throw new Error("Forbidden");
}

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
  return data as null | {
    id: string; admin_status: string; whatsapp_enabled: boolean;
    whatsapp_country_code: string; whatsapp_number: string | null; whatsapp_webhook_url: string | null;
  };
}

export const getAdminPresence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const c = await latestConfig(await admin());
    return {
      status: (c?.admin_status === "away" ? "away" : "online") as "online" | "away",
      whatsappEnabled: !!c?.whatsapp_enabled,
      countryCode: c?.whatsapp_country_code ?? "+92",
      number: c?.whatsapp_number ?? "",
      webhookUrl: c?.whatsapp_webhook_url ?? "",
    };
  });

export const updateAdminPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      status: z.enum(["online", "away"]).optional(),
      whatsappEnabled: z.boolean().optional(),
      countryCode: z.string().trim().regex(/^\+\d{1,4}$/).optional(),
      number: z.string().trim().regex(/^\d{0,15}$/).optional(),
      webhookUrl: z.union([z.literal(""), z.string().trim().url().max(500)]).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const db = await admin();
    const patch: Record<string, unknown> = {};
    if (data.status) patch.admin_status = data.status;
    if (data.whatsappEnabled !== undefined) patch.whatsapp_enabled = data.whatsappEnabled;
    if (data.countryCode) patch.whatsapp_country_code = data.countryCode;
    if (data.number !== undefined) patch.whatsapp_number = data.number || null;
    if (data.webhookUrl !== undefined) patch.whatsapp_webhook_url = data.webhookUrl || null;
    const c = await latestConfig(db);
    const { error } = c
      ? await db.from("bot_config").update(patch).eq("id", c.id)
      : await db.from("bot_config").insert({ system_prompt: "", ...patch });
    if (error) throw new Error("Failed to save");
    return { ok: true };
  });

