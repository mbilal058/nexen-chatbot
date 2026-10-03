import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PUBLISHED_ORIGIN = "https://nexenchatbot.lovable.app";

// Preview hosts sit behind the Lovable access bridge, so invite links must
// always land on the public app instead.
function safeRedirect(requested: string) {
  try {
    const u = new URL(requested);
    const preview = /(^|\.)(id-preview--|preview--)|lovableproject\.com$|localhost/.test(u.host) || u.host.startsWith("id-preview--");
    if (u.protocol === "https:" && !preview) return `${u.origin}/set-password`;
  } catch { /* fall through */ }
  return `${PUBLISHED_ORIGIN}/set-password`;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Only admins can manage team access.");
}

export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: roles }, { data: users }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers({ perPage: 200 }),
    ]);
    const roleById = new Map<string, "admin" | "staff">();
    for (const r of roles ?? []) {
      if (r.role === "admin" || !roleById.has(r.user_id)) roleById.set(r.user_id, r.role as "admin" | "staff");
    }
    // List every login, including ones with no role, so leftover accounts can be deleted.
    return (users?.users ?? []).map((u) => ({
      userId: u.id,
      role: (roleById.get(u.id) ?? "none") as "admin" | "staff" | "none",
      email: u.email ?? "(unknown)",
      pending: !u.last_sign_in_at,
      isYou: u.id === context.userId,
    }));
  });

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      email: z.string().trim().toLowerCase().email().max(255),
      role: z.enum(["admin", "staff"]),
      redirectTo: z.string().url().max(500),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const redirectTo = safeRedirect(data.redirectTo);
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw new Error("Could not check existing accounts.");
    const existing = list.users.find((u) => u.email?.toLowerCase() === data.email);

    let userId: string;
    if (existing) {
      // Account already exists: send a password-set link instead of a new invite.
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, { redirectTo });
      if (error) throw new Error(`Could not email ${data.email}: ${error.message}`);
      userId = existing.id;
    } else {
      const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo });
      if (error || !invited?.user) throw new Error(`Invitation email failed: ${error?.message ?? "unknown error"}`);
      userId = invited.user.id;
    }
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });
    if (roleErr) throw new Error("Email sent, but access could not be assigned.");
    return { ok: true, existing: !!existing };
  });

export const revokeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You can't remove your own access.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    // Delete the login itself so the email can be cleanly re-invited later.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) console.error("[team] deleteUser failed", data.userId, error);
    if (error && !/not found/i.test(error.message)) throw new Error(`Failed to delete account: ${error.message}`);
    return { ok: true };
  });
