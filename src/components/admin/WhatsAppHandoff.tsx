import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAdminPresence, updateAdminPresence } from "@/lib/admin-status.functions";

const COUNTRY_CODES = [
  { code: "+92", label: "PK +92" }, { code: "+971", label: "AE +971" }, { code: "+966", label: "SA +966" },
  { code: "+44", label: "UK +44" }, { code: "+1", label: "US +1" }, { code: "+91", label: "IN +91" },
];

export function AdminStatusToggle() {
  const load = useServerFn(getAdminPresence);
  const save = useServerFn(updateAdminPresence);
  const [status, setStatus] = useState<"online" | "away">("online");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    load().then((d) => setStatus(d.status)).catch(() => {}).finally(() => setBusy(false));
  }, [load]);

  async function toggle(away: boolean) {
    const next = away ? "away" : "online";
    const prev = status;
    setStatus(next); setBusy(true);
    try {
      await save({ data: { status: next } });
      toast.success(next === "away" ? "Status set to Away — urgent handoffs go to WhatsApp" : "Status set to Online");
    } catch {
      setStatus(prev);
      toast.error("Couldn't update your status.");
    } finally { setBusy(false); }
  }

  const away = status === "away";
  return (
    <label className="flex items-center gap-2 rounded-md border border-brand-800/15 bg-white px-2 py-1" title="Admin Status">
      <span className={cn("h-2.5 w-2.5 rounded-full", away ? "bg-brand-amber" : "bg-status-online")} aria-hidden />
      <span className="hidden text-xs text-brand-800/70 lg:inline">Admin Status:</span>
      <span className="text-xs font-semibold text-brand-800">{away ? "Away" : "Online"}</span>
      <Switch checked={away} onCheckedChange={toggle} disabled={busy} aria-label="Admin Status: switch to Away" />
    </label>
  );
}

export function WhatsAppBadge() {
  return (
    <span title="Routed to WhatsApp (Away mode)" aria-label="Routed to WhatsApp"
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-whatsapp/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">
      <MessageCircle className="h-3 w-3 text-whatsapp" /> WhatsApp
    </span>
  );
}

export function WhatsAppSettingsCard() {
  const load = useServerFn(getAdminPresence);
  const save = useServerFn(updateAdminPresence);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [cc, setCc] = useState("+92");
  const [number, setNumber] = useState("");
  const [webhook, setWebhook] = useState("");

  useEffect(() => {
    load().then((d) => {
      setEnabled(d.whatsappEnabled); setCc(d.countryCode); setNumber(d.number); setWebhook(d.webhookUrl);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [load]);

  async function handleSave() {
    if (enabled && (!number || !webhook)) return toast.error("Add the WhatsApp number and n8n webhook URL first.");
    setSaving(true);
    try {
      await save({ data: { whatsappEnabled: enabled, countryCode: cc, number: number.replace(/\D/g, ""), webhookUrl: webhook.trim() } });
      toast.success("WhatsApp handoff settings saved");
    } catch {
      toast.error("Couldn't save — check the number and webhook URL.");
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-lg border border-brand-800/15 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-800">WhatsApp Handoff Alerts</h2>
          <p className="text-sm text-brand-800/65">Send urgent human handoffs to your phone while you're away.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-brand-800">
          Enable WhatsApp Alerts
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={loading} />
        </label>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-800">Admin/CEO WhatsApp Number</label>
          <div className="flex gap-2">
            <Select value={cc} onValueChange={setCc} disabled={loading}>
              <SelectTrigger className="w-[110px] bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRY_CODES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="3001234567" disabled={loading} className="bg-white" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-800">n8n WhatsApp Webhook URL</label>
          <Input value={webhook} onChange={(e) => setWebhook(e.target.value)} disabled={loading}
            placeholder="https://your-n8n.app.n8n.cloud/webhook/..." className="bg-white" />
        </div>
      </div>
      <p className="mt-4 rounded-md border border-brand-amber/40 bg-brand-amber/10 p-3 text-xs italic text-brand-800">
        Note: WhatsApp two-way chat acts as a fallback feature. It will only activate and route client messages to your mobile when your dashboard status is set to 'Away/Off-duty'.
      </p>
      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} disabled={loading || saving} className="gap-1.5 bg-brand-500 text-white hover:bg-brand-500/90">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Save WhatsApp Settings
        </Button>
      </div>
    </div>
  );
}
