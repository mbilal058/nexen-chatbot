import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formatPakistanDateTime } from "@/lib/date-time";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function fetchEmailSettings() {
  try {
    const supabase = await admin();
    const { data } = await supabase
      .from("bot_config")
      .select("resend_api_key, sender_email, admin_email")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      apiKey: (data?.resend_api_key || process.env.RESEND_API_KEY || "").trim(),
      sender: (data?.sender_email || "Nexen Strategy Alerts <onboarding@resend.dev>").trim(),
      to: (data?.admin_email || "").trim(),
    };
  } catch (err) {
    console.error("[handoffAlert] failed to load email settings", err);
    return {
      apiKey: (process.env.RESEND_API_KEY || "").trim(),
      sender: "Nexen Strategy Alerts <onboarding@resend.dev>",
      to: "",
    };
  }
}

/**
 * Sends the human-handoff alert email to the admin via Resend.
 * Called fire-and-forget from the widget so the chat flow never waits on it.
 */
export const sendHandoffAlertEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string; appUrl?: string }) =>
    z
      .object({
        sessionId: z.string().trim().uuid(),
        appUrl: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { apiKey, sender, to } = await fetchEmailSettings();
    if (!apiKey) {
      console.error("[handoffAlert] no Resend API key configured");
      return { ok: false, error: "missing_api_key" };
    }
    if (!to) {
      console.error("[handoffAlert] no admin notification email configured");
      return { ok: false, error: "missing_admin_email" };
    }

    const base = (data.appUrl || process.env.ADMIN_PANEL_URL || "https://nexenchatbot.lovable.app").replace(/\/$/, "");
    const adminLink = `${base}/admin?session=${encodeURIComponent(data.sessionId)}&tab=chats`;
    const pkTime = formatPakistanDateTime(new Date());
    const { data: chatRow } = await (await admin())
      .from("chats")
      .select("session_number")
      .eq("id", data.sessionId)
      .maybeSingle();
    const n = (chatRow as { session_number?: number } | null)?.session_number;
    const displayId = typeof n === "number" ? `NS${String(n).padStart(4, "0")}` : data.sessionId;

    const subject = `[HUMAN HANDOFF ALERT] Session ID: ${displayId}`;
    const text = [
      "A client needs immediate human support in the Nexen Strategy chat widget.",
      "",
      `Session ID: ${displayId}`,
      `Timestamp (Pakistan Time): ${pkTime}`,
      `Open this chat: ${adminLink}`,
      "",
      "Please jump into the Live Chats panel and reply as soon as possible.",
    ].join("\n");
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;line-height:1.6">
        <h2 style="color:#000a61;margin:0 0 12px">Human Handoff Alert</h2>
        <p>A client needs <strong>immediate human support</strong> in the Nexen Strategy chat widget.</p>
        <ul>
          <li><strong>Session ID:</strong> ${escapeHtml(displayId)}</li>
          <li><strong>Timestamp (Pakistan Time):</strong> ${escapeHtml(pkTime)}</li>
        </ul>
        <p><a href="${adminLink}" style="background:#000a61;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Open this chat</a></p>
        <p style="color:#475569">Please reply in the Live Chats panel as soon as possible.</p>
      </div>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from: sender, to: [to], subject, text, html }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`[handoffAlert] Resend failed [${res.status}]: ${body}`);
        return { ok: false, error: `resend_${res.status}` };
      }
      console.log("[handoffAlert] sent", { sessionId: data.sessionId, adminLink });
      return { ok: true };
    } catch (err) {
      console.error("[handoffAlert] network error", err);
      return { ok: false, error: "network" };
    }
  });

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
