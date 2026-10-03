import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Inbox, Loader2, Mail, PenSquare, RefreshCw, Reply, Save, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  sendGmailEmail, getGmailStatus, listGmailMessages, getGmailThread, replyGmail, saveGmailDraft, FROM_IDENTITIES,
} from "@/lib/gmail.functions";
import { takeEmailPrefill } from "@/lib/email-prefill";
import { formatPakistanDateTime } from "@/lib/date-time";

type Folder = "inbox" | "unread" | "sent" | "drafts";
type Row = { id: string; threadId: string; from: string; to: string; subject: string; snippet: string; date: number; unread: boolean };
type ThreadMsg = { id: string; from: string; to: string; subject: string; messageIdHeader: string; references: string; date: number; html: string | null; text: string | null };

const TEMPLATES: Record<string, { label: string; subject: string; body: (n: string) => string }> = {
  reschedule: {
    label: "Meeting Reschedule Request",
    subject: "Request to Reschedule Our Meeting — Nexen Strategy",
    body: (n) => `Dear ${n},\n\nThank you for booking a meeting with Nexen Strategy. Unfortunately, we need to reschedule our upcoming session.\n\nCould you please share two or three time slots that work for you this week? We will confirm right away.\n\nApologies for the inconvenience.\n\nBest regards,\nNexen Strategy Team`,
  },
  followup: {
    label: "Quotation Follow-up",
    subject: "Following Up on Your Quotation Request — Nexen Strategy",
    body: (n) => `Dear ${n},\n\nThank you for requesting a quotation from Nexen Strategy. We have reviewed your requirements and would love to discuss the scope, timeline, and budget in more detail.\n\nPlease let us know a convenient time for a short call, or reply with any questions.\n\nBest regards,\nNexen Strategy Team`,
  },
  inquiry: {
    label: "General Inquiry Response",
    subject: "Thank You for Contacting Nexen Strategy",
    body: (n) => `Dear ${n},\n\nThank you for reaching out to Nexen Strategy. We have received your inquiry and our team will get back to you with the details shortly.\n\nIn the meantime, feel free to reply to this email with any additional information.\n\nBest regards,\nNexen Strategy Team`,
  },
};

const FOLDERS: { key: Folder; label: string }[] = [
  { key: "inbox", label: "All Inbox" }, { key: "unread", label: "Unread" },
  { key: "sent", label: "Sent" }, { key: "drafts", label: "Drafts" },
];

type FromId = (typeof FROM_IDENTITIES)[number];
const empty = { from: FROM_IDENTITIES[0] as FromId, to: "", cc: "", bcc: "", subject: "", body: "" };
const nameOf = (s: string) => s.replace(/<.*?>/, "").replace(/"/g, "").trim() || s;
const addrOf = (s: string) => /<([^>]+)>/.exec(s)?.[1] ?? s.trim();

export function GmailPanel() {
  const send = useServerFn(sendGmailEmail);
  const status = useServerFn(getGmailStatus);
  const list = useServerFn(listGmailMessages);
  const thread = useServerFn(getGmailThread);
  const reply = useServerFn(replyGmail);
  const draft = useServerFn(saveGmailDraft);

  const [account, setAccount] = useState<string | null>(null);
  const [folder, setFolder] = useState<Folder>("inbox");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [activeQ, setActiveQ] = useState("");
  const [openThread, setOpenThread] = useState<Row | null>(null);
  const [msgs, setMsgs] = useState<ThreadMsg[] | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyFrom, setReplyFrom] = useState<FromId>(FROM_IDENTITIES[0]);
  const [replyOpen, setReplyOpen] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [name, setName] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [template, setTemplate] = useState("");
  const [sending, setSending] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async (silent = false) => {
    const id = ++reqId.current;
    if (!silent) setRefreshing(true);
    try {
      const r = await list({ data: { folder, q: activeQ || undefined } });
      if (id === reqId.current) setRows(r);
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "Couldn't load emails.");
    } finally {
      if (id === reqId.current) { setLoading(false); setRefreshing(false); }
    }
  }, [folder, activeQ, list]);

  useEffect(() => { setLoading(true); void load(); }, [load]);
  useEffect(() => {
    const t = window.setInterval(() => { if (!document.hidden) void load(true); }, 30000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    status().then((s) => setAccount(s.connected ? s.email : null)).catch(() => {});
    const p = takeEmailPrefill();
    if (p) {
      const n = p.name || "there";
      const t = p.kind === "meeting" ? "reschedule" : "followup";
      const tpl = TEMPLATES[t]!;
      setName(n); setTemplate(t);
      setForm({ ...empty, to: p.to, subject: tpl.subject, body: tpl.body(n) + (p.details ? `\n\n—\nReference details:\n${p.details}` : "") });
      setComposeOpen(true);
    }
  }, []);

  async function open(r: Row) {
    setOpenThread(r); setMsgs(null); setReplyText(""); setReplyOpen(false);
    try {
      const m = await thread({ data: { threadId: r.threadId } });
      setMsgs(m);
      if (r.unread) setRows((rs) => rs.map((x) => (x.threadId === r.threadId ? { ...x, unread: false } : x)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the email.");
    }
  }

  async function sendReply() {
    if (!msgs?.length || !replyText.trim()) return;
    const last = msgs[msgs.length - 1]!;
    const me = (account ?? "").toLowerCase();
    const inbound = [...msgs].reverse().find((m) => addrOf(m.from).toLowerCase() !== me);
    const to = inbound ? addrOf(inbound.from) : addrOf(last.to);
    setReplying(true);
    try {
      await reply({ data: { threadId: openThread!.threadId, from: replyFrom, to, subject: msgs[0]!.subject, inReplyTo: last.messageIdHeader, references: last.references, body: replyText } });
      toast.success(`Reply sent to ${to}`);
      setReplyText(""); setReplyOpen(false);
      const m = await thread({ data: { threadId: openThread!.threadId } });
      setMsgs(m);
      void load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the reply.");
    } finally { setReplying(false); }
  }

  const set = (k: Exclude<keyof typeof empty, "from">) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  function applyTemplate(key: string) {
    setTemplate(key);
    const tpl = TEMPLATES[key];
    if (tpl) setForm((f) => ({ ...f, subject: tpl.subject, body: tpl.body(name || "there") }));
  }
  function resetCompose() { setForm(empty); setTemplate(""); setName(""); setShowCc(false); }

  async function handleSend() {
    if (!form.to.trim() || !form.subject.trim() || !form.body.trim()) return toast.error("Please fill To, Subject and Message.");
    setSending(true);
    try {
      const res = await send({ data: form });
      if (res.ok) { toast.success(`Email sent to ${form.to}`); resetCompose(); setComposeOpen(false); void load(true); }
      else toast.error(res.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the email.");
    } finally { setSending(false); }
  }

  async function handleDraft() {
    if (!form.to.trim() && !form.subject.trim()) return toast.error("Add a recipient or subject first.");
    try {
      await draft({ data: form });
      toast.success("Draft saved to Gmail.");
      resetCompose(); setComposeOpen(false);
      if (folder === "drafts") void load(true);
    } catch { toast.error("Couldn't save the draft."); }
  }

  const labelCls = "text-xs font-semibold uppercase tracking-wide text-brand-800/70";
  const inputCls = "border-brand-800/20 bg-white text-brand-800 focus-visible:ring-brand-cyan";

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white text-brand-800">
      <div className="flex flex-wrap items-center gap-2 border-b border-brand-800/15 bg-white px-4 py-3">
        <h2 className="mr-auto flex items-center gap-2 text-sm font-semibold text-brand-800">
          <Mail className="h-4 w-4" /> Gmail
          {account && <span className="hidden font-normal text-brand-800/65 sm:inline">· {account}</span>}
        </h2>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={refreshing}
          className="gap-1.5 border-brand-800/20 bg-white text-brand-800 hover:bg-brand-500 hover:text-white">
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh
        </Button>
        <Button size="sm" className="gap-1.5 bg-brand-500 text-white hover:bg-brand-500/90" onClick={() => { resetCompose(); setComposeOpen(true); }}>
          <PenSquare className="h-3.5 w-3.5" /> Compose
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-brand-800/15 px-4 py-2">
        <div className="flex gap-1 overflow-x-auto">
          {FOLDERS.map((f) => (
            <button key={f.key} type="button" onClick={() => { setFolder(f.key); setOpenThread(null); }}
              className={cn("whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
                folder === f.key ? "bg-brand-800 text-white" : "text-brand-800 hover:bg-brand-500/10")}>
              {f.label}
            </button>
          ))}
        </div>
        <form className="relative ml-auto" onSubmit={(e) => { e.preventDefault(); setActiveQ(query.trim()); }}>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-800/60" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mail…" aria-label="Search mail" className={cn(inputCls, "h-8 w-48 pl-8")} />
        </form>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <section className={cn("flex-1 overflow-auto border-r border-brand-800/15 lg:max-w-[440px]", openThread && "hidden lg:block")}>
          {loading ? (
            <p className="flex items-center gap-2 p-4 text-sm text-brand-800/65"><Loader2 className="h-4 w-4 animate-spin" /> Loading emails…</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-sm text-brand-800/65"><Inbox className="h-6 w-6" /> No emails here.</div>
          ) : (
            <ul>
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => open(r)}
                    className={cn("block w-full border-b border-brand-800/10 px-4 py-3 text-left transition-colors hover:bg-brand-500/5",
                      openThread?.threadId === r.threadId && "bg-brand-500/10",
                      r.unread && "border-l-4 border-l-brand-800")}>
                    <div className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", r.unread ? "font-bold" : "font-medium")}>
                        {folder === "sent" || folder === "drafts" ? `To: ${nameOf(r.to) || "(no recipient)"}` : nameOf(r.from)}
                      </span>
                      {r.unread && <span className="shrink-0 rounded-full bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold text-white">NEW</span>}
                      <span className="ml-auto shrink-0 text-[11px] text-brand-800/55">{formatPakistanDateTime(new Date(r.date))}</span>
                    </div>
                    <p className={cn("truncate text-sm", r.unread ? "font-semibold" : "text-brand-800/85")}>{r.subject || "(no subject)"}</p>
                    <p className="truncate text-xs text-brand-800/60">{r.snippet}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Thread */}
        <section className={cn("flex flex-1 flex-col overflow-hidden", !openThread && "hidden lg:flex")}>
          {!openThread ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-brand-800/60">
              <Mail className="h-8 w-8 text-brand-cyan" /> Select an email to read it.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-brand-800/15 px-4 py-3">
                <button type="button" onClick={() => setOpenThread(null)} aria-label="Back" className="rounded p-1 hover:bg-brand-500/10 lg:hidden">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h3 className="truncate text-base font-semibold">{openThread.subject || "(no subject)"}</h3>
              </div>
              <div className="flex-1 space-y-3 overflow-auto p-4">
                {!msgs ? (
                  <p className="flex items-center gap-2 text-sm text-brand-800/65"><Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…</p>
                ) : msgs.map((m) => (
                  <article key={m.id} className="rounded-xl border border-brand-800/15 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold">{nameOf(m.from)}</span>
                      <span className="text-xs text-brand-800/60">&lt;{addrOf(m.from)}&gt;</span>
                      <span className="ml-auto text-xs text-brand-800/55">{formatPakistanDateTime(new Date(m.date))}</span>
                    </div>
                    <p className="mb-3 text-xs text-brand-800/60">To {m.to}</p>
                    {m.html ? (
                      <iframe title="Email content" sandbox="" srcDoc={m.html} className="h-96 w-full rounded border border-brand-800/10 bg-white" />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-brand-800/90">{m.text}</p>
                    )}
                  </article>
                ))}
              </div>
              {folder !== "drafts" && msgs && msgs.length > 0 && (
                <div className="border-t border-brand-800/15 bg-white">
                  {!replyOpen ? (
                    <div className="px-3 py-2.5">
                      <Button size="sm" onClick={() => setReplyOpen(true)}
                        className="gap-1.5 bg-brand-500 text-white hover:bg-brand-500/90">
                        <Reply className="h-3.5 w-3.5" /> Reply
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 p-3">
                      <div className="space-y-1">
                        <label className={labelCls} htmlFor="em-reply-from">From:</label>
                        <Select value={replyFrom} onValueChange={(v) => setReplyFrom(v as FromId)}>
                          <SelectTrigger id="em-reply-from" className="h-9 w-full border-brand-800 bg-white text-brand-800 focus:ring-brand-cyan"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FROM_IDENTITIES.map((f) => <SelectItem key={f} value={f} className="text-brand-800">{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={4}
                        placeholder="Write your reply…" className={cn(inputCls, "min-h-[96px]")} autoFocus />
                      <div className="mt-2 flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setReplyOpen(false)}
                          className="border-brand-800/20 bg-white text-brand-800 hover:bg-brand-500 hover:text-white">
                          Cancel
                        </Button>
                        <Button size="sm" onClick={sendReply} disabled={replying || !replyText.trim()} className="gap-1.5 bg-brand-500 text-white hover:bg-brand-500/90">
                          {replying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send Reply
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="admin-theme max-h-[92vh] overflow-auto bg-white text-brand-800 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand-800">New Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={template} onValueChange={applyTemplate}>
              <SelectTrigger className="h-8 w-full border-brand-800/20 text-xs sm:w-[260px]"><SelectValue placeholder="Quick template…" /></SelectTrigger>
              <SelectContent>
                {Object.entries(TEMPLATES).map(([k, t]) => <SelectItem key={k} value={k}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
<div className="space-y-1">
                    <label className={labelCls} htmlFor="em-from">From:</label>
                    <Select value={form.from} onValueChange={(v) => ((v: FromId) => setForm((f) => ({ ...f, from: v })))(v as FromId)}>
                      <SelectTrigger id="em-from" className="h-9 w-full border-brand-800 bg-white text-brand-800 focus:ring-brand-cyan"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FROM_IDENTITIES.map((f) => <SelectItem key={f} value={f} className="text-brand-800">{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelCls} htmlFor="em-to">To</label>
                <button type="button" onClick={() => setShowCc((v) => !v)} className="text-xs font-medium text-brand-500 hover:underline">
                  {showCc ? "Hide CC/BCC" : "CC/BCC"}
                </button>
              </div>
              <Input id="em-to" type="email" value={form.to} onChange={(e) => set("to")(e.target.value)} placeholder="client@company.com" className={inputCls} />
            </div>
            {showCc && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className={labelCls} htmlFor="em-cc">CC</label>
                  <Input id="em-cc" value={form.cc} onChange={(e) => set("cc")(e.target.value)} placeholder="comma separated" className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls} htmlFor="em-bcc">BCC</label>
                  <Input id="em-bcc" value={form.bcc} onChange={(e) => set("bcc")(e.target.value)} placeholder="comma separated" className={inputCls} />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className={labelCls} htmlFor="em-subj">Subject</label>
              <Input id="em-subj" value={form.subject} onChange={(e) => set("subject")(e.target.value)} placeholder="Subject" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls} htmlFor="em-body">Message</label>
              <Textarea id="em-body" value={form.body} onChange={(e) => set("body")(e.target.value)} rows={10}
                placeholder="Write your message…" className={cn(inputCls, "min-h-[200px] leading-relaxed")} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleDraft} className="gap-1.5 border-brand-800/20 bg-white text-brand-800 hover:bg-brand-500 hover:text-white">
                <Save className="h-3.5 w-3.5" /> Save Draft
              </Button>
              <Button size="sm" onClick={handleSend} disabled={sending} className="gap-1.5 bg-brand-500 text-white hover:bg-brand-500/90">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
