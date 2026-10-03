import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function keys() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const gmail = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovable || !gmail) throw new Error("Gmail is not connected.");
  return { lovable, gmail };
}

async function assertStaff(supabase: any, userId: string) {
  const [{ data: a }, { data: s }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "staff" }),
  ]);
  if (!a && !s) throw new Error("Forbidden");
}

const b64 = (s: string) =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const FROM_IDENTITIES = ["admin@nexenstrategy.com", "ceo@nexenstrategy.com", "hr@nexenstrategy.com"] as const;
const fromSchema = z.enum(FROM_IDENTITIES).optional();

const emailList = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (v) => !v || v.split(",").every((e) => z.string().email().safeParse(e.trim()).success),
    "Invalid email address",
  );

export const getGmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    try {
      const { lovable, gmail } = keys();
      const res = await fetch(`${GATEWAY_URL}/users/me/profile`, {
        headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": gmail },
      });
      if (!res.ok) {
        console.error(`[gmail] profile failed [${res.status}]: ${await res.text()}`);
        return { connected: false as const, email: null };
      }
      const p = (await res.json()) as { emailAddress?: string };
      return { connected: true as const, email: p.emailAddress ?? null };
    } catch {
      return { connected: false as const, email: null };
    }
  });

export const sendGmailEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        from: fromSchema,
        to: emailList.refine((v) => v.length > 0, "Recipient required"),
        cc: emailList.optional().default(""),
        bcc: emailList.optional().default(""),
        subject: z.string().trim().min(1).max(300),
        body: z.string().trim().min(1).max(20000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { lovable, gmail } = keys();
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000a61;line-height:1.6">${escapeHtml(
      data.body,
    ).replace(/\n/g, "<br>")}</div>`;
    const headers = [
      data.from ? `From: ${data.from}` : "",
      `To: ${data.to}`,
      data.cc ? `Cc: ${data.cc}` : "",
      data.bcc ? `Bcc: ${data.bcc}` : "",
      `Subject: ${header(data.subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
    ].filter(Boolean);
    const raw = b64([...headers, "", html].join("\r\n")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": gmail,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    const base = {
      to_email: data.to, cc: data.cc || null, bcc: data.bcc || null,
      subject: data.subject, body: data.body, sent_by: context.userId, from_email: data.from ?? null,
    };
    if (!res.ok) {
      const err = await res.text();
      console.error(`[gmail] send failed [${res.status}]: ${err}`);
      await (context.supabase as any).from("email_logs").insert({ ...base, status: "failed", error: `${res.status}` });
      return { ok: false as const, error: `Gmail rejected the email (${res.status}).` };
    }
    const sent = (await res.json()) as { id?: string; threadId?: string };
    await (context.supabase as any).from("email_logs").insert({
      ...base, status: "sent", gmail_message_id: sent.id ?? null, gmail_thread_id: sent.threadId ?? null,
    });
    return { ok: true as const };
  });

// ---------- Inbox / threads ----------
const BATCH_URL = "https://connector-gateway.lovable.dev/google_mail/batch/gmail/v1";

type Hdr = { name: string; value: string };
type GMsg = {
  id: string; threadId: string; labelIds?: string[]; snippet?: string; internalDate?: string;
  payload?: { headers?: Hdr[]; mimeType?: string; body?: { data?: string }; parts?: any[] };
};
const hv = (m: GMsg, n: string) =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";

async function gw(path: string, init?: RequestInit) {
  const { lovable, gmail } = keys();
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": gmail, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`[gmail] ${path} [${res.status}]: ${t}`);
    throw new Error(`Gmail request failed (${res.status})`);
  }
  return res.json();
}

async function batchGet(ids: string[]): Promise<GMsg[]> {
  if (!ids.length) return [];
  const { lovable, gmail } = keys();
  const boundary = "batch_nexen";
  const q = "format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date";
  const body = ids.map((id, i) =>
    `--${boundary}\r\nContent-Type: application/http\r\nContent-ID: <i${i}>\r\n\r\nGET /gmail/v1/users/me/messages/${id}?${q}\r\n\r\n`,
  ).join("") + `--${boundary}--`;
  const res = await fetch(BATCH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": gmail, "Content-Type": `multipart/mixed; boundary=${boundary}` },
    body,
  });
  const text = await res.text();
  if (!res.ok) { console.error(`[gmail] batch [${res.status}]: ${text}`); throw new Error(`Gmail batch failed (${res.status})`); }
  const ct = res.headers.get("content-type") ?? "";
  const rb = /boundary=("?)([^";]+)\1/.exec(ct)?.[2];
  if (!ct.includes("multipart/mixed") || !rb) throw new Error("Unexpected Gmail batch response");
  const out: GMsg[] = [];
  for (const part of text.split(`--${rb}`)) {
    const m = /HTTP\/1\.1 (\d{3})[^\r\n]*\r?\n([\s\S]*)$/.exec(part);
    if (!m) continue;
    const rest = m[2]!;
    const sep = rest.search(/\r?\n\r?\n/);
    const json = sep >= 0 ? rest.slice(sep).trim() : "";
    if (m[1] !== "200") { console.error(`[gmail] batch part ${m[1]}: ${json.slice(0, 300)}`); continue; }
    try { out.push(JSON.parse(json)); } catch { /* skip */ }
  }
  const order = new Map(ids.map((id, i) => [id, i]));
  return out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

const FOLDERS = { inbox: "labelIds=INBOX", unread: "labelIds=INBOX&labelIds=UNREAD", sent: "labelIds=SENT", drafts: "labelIds=DRAFT" } as const;

export const listGmailMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ folder: z.enum(["inbox", "unread", "sent", "drafts"]), q: z.string().max(200).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const q = data.q ? `&q=${encodeURIComponent(data.q)}` : "";
    const list = (await gw(`/users/me/messages?maxResults=30&${FOLDERS[data.folder]}${q}`)) as { messages?: { id: string }[] };
    const msgs = await batchGet((list.messages ?? []).map((m) => m.id));
    return msgs.map((m) => ({
      id: m.id, threadId: m.threadId, from: hv(m, "From"), to: hv(m, "To"), subject: hv(m, "Subject"),
      snippet: m.snippet ?? "", date: Number(m.internalDate ?? 0), unread: !!m.labelIds?.includes("UNREAD"),
    }));
  });

function decode(d?: string) {
  if (!d) return "";
  const bin = atob(d.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function findPart(p: any, mime: string): string | null {
  if (!p) return null;
  if (p.mimeType === mime && p.body?.data) return decode(p.body.data);
  for (const c of p.parts ?? []) { const r = findPart(c, mime); if (r) return r; }
  return null;
}

export const getGmailThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ threadId: z.string().regex(/^[a-zA-Z0-9]+$/) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const t = (await gw(`/users/me/threads/${data.threadId}?format=full`)) as { messages?: GMsg[] };
    const msgs = t.messages ?? [];
    if (msgs.some((m) => m.labelIds?.includes("UNREAD"))) {
      await gw(`/users/me/threads/${data.threadId}/modify`, { method: "POST", body: JSON.stringify({ removeLabelIds: ["UNREAD"] }) }).catch(() => {});
    }
    return msgs.map((m) => {
      const html = findPart(m.payload, "text/html");
      const text = findPart(m.payload, "text/plain");
      return {
        id: m.id, from: hv(m, "From"), to: hv(m, "To"), subject: hv(m, "Subject"),
        messageIdHeader: hv(m, "Message-ID") || hv(m, "Message-Id"), references: hv(m, "References"),
        date: Number(m.internalDate ?? 0), html: html ?? null, text: text ?? (html ? null : m.snippet ?? ""),
      };
    });
  });

export const replyGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    threadId: z.string().regex(/^[a-zA-Z0-9]+$/), from: fromSchema, to: z.string().trim().min(3).max(500),
    subject: z.string().max(300), inReplyTo: z.string().max(500), references: z.string().max(4000),
    body: z.string().trim().min(1).max(20000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const subject = /^re:/i.test(data.subject) ? data.subject : `Re: ${data.subject}`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000a61;line-height:1.6">${escapeHtml(data.body).replace(/\n/g, "<br>")}</div>`;
    const h = [
      data.from ? `From: ${data.from}` : "",
      `To: ${data.to.replace(/[\r\n]/g, "")}`, `Subject: ${header(subject)}`,
      data.inReplyTo ? `In-Reply-To: ${data.inReplyTo.replace(/[\r\n]/g, "")}` : "",
      data.inReplyTo ? `References: ${`${data.references} ${data.inReplyTo}`.trim().replace(/[\r\n]/g, "")}` : "",
      "MIME-Version: 1.0", 'Content-Type: text/html; charset="UTF-8"',
    ].filter(Boolean);
    const raw = b64([...h, "", html].join("\r\n")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const sent = (await gw(`/users/me/messages/send`, { method: "POST", body: JSON.stringify({ raw, threadId: data.threadId }) })) as { id?: string };
    await (context.supabase as any).from("email_logs").insert({
      to_email: data.to, subject, body: data.body, sent_by: context.userId, status: "sent",
      gmail_message_id: sent.id ?? null, gmail_thread_id: data.threadId, from_email: data.from ?? null,
    });
    return { ok: true as const };
  });

export const saveGmailDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ to: z.string().max(1000), cc: z.string().max(1000), bcc: z.string().max(1000), subject: z.string().max(300), body: z.string().max(20000) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const clean = (s: string) => s.replace(/[\r\n]/g, "");
    const h = [
      data.to ? `To: ${clean(data.to)}` : "", data.cc ? `Cc: ${clean(data.cc)}` : "", data.bcc ? `Bcc: ${clean(data.bcc)}` : "",
      `Subject: ${header(clean(data.subject))}`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"',
    ].filter(Boolean);
    const raw = b64([...h, "", data.body].join("\r\n")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await gw(`/users/me/drafts`, { method: "POST", body: JSON.stringify({ message: { raw } }) });
    return { ok: true as const };
  });
