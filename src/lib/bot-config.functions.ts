import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getBotConfig = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("bot_config")
    .select("id, system_prompt, temperature, updated_at, resend_api_key, sender_email, admin_email")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Failed to load bot config");
  if (!data) {
    return {
      id: null,
      system_prompt: "",
      temperature: 0.3,
      updated_at: null,
      sender_email: "",
      admin_email: "",
      resend_api_key_set: false,
    };
  }
  const { resend_api_key, ...rest } = data as typeof data & { resend_api_key: string | null };
  return {
    ...rest,
    sender_email: rest.sender_email ?? "",
    admin_email: rest.admin_email ?? "",
    // Never send the key itself to the browser.
    resend_api_key_set: Boolean(resend_api_key?.trim()),
  };
});

export const updateBotConfig = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      systemPrompt?: string;
      temperature?: number;
      resendApiKey?: string;
      senderEmail?: string;
      adminEmail?: string;
    }) =>
      z
        .object({
          systemPrompt: z.string().trim().min(1).max(20000).optional(),
          temperature: z.number().min(0).max(1).optional(),
          resendApiKey: z.string().trim().max(200).optional(),
          senderEmail: z.string().trim().max(200).optional(),
          adminEmail: z.string().trim().max(200).optional(),
        })
        .refine((v) => Object.values(v).some((x) => x !== undefined), {
          message: "Nothing to update",
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = await admin();
    const { data: existing } = await supabase
      .from("bot_config")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const patch: {
      system_prompt?: string;
      temperature?: number;
      resend_api_key?: string;
      sender_email?: string;
      admin_email?: string;
    } = {};
    if (data.systemPrompt !== undefined) patch.system_prompt = data.systemPrompt;
    if (data.temperature !== undefined) patch.temperature = data.temperature;
    // An empty key string means "leave the stored key untouched".
    if (data.resendApiKey) patch.resend_api_key = data.resendApiKey;
    if (data.senderEmail !== undefined) patch.sender_email = data.senderEmail;
    if (data.adminEmail !== undefined) patch.admin_email = data.adminEmail;
    if (existing?.id) {
      const { error } = await supabase
        .from("bot_config")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw new Error("Failed to save config");
    } else {
      const { error } = await supabase
        .from("bot_config")
        .insert({
          system_prompt: data.systemPrompt ?? "",
          ...(data.temperature !== undefined ? { temperature: data.temperature } : {}),
          ...patch,
        });
      if (error) throw new Error("Failed to save config");
    }
    return { ok: true };
  });
