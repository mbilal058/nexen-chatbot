import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { setEmailPrefill } from "@/lib/email-prefill";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { QUOTATION_STATUSES } from "@/lib/nexen";
import { Download, FlaskConical, Loader2, Mail, Search, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type Quotation = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  contact: string | null;
  main_services: string[] | null;
  sub_categories: string[] | null;
  budget: string | null;
  currency: string;
  status: string;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "border-brand-amber bg-brand-amber/15 text-brand-800",
  reviewed: "border-brand-cyan bg-brand-cyan/15 text-brand-800",
  contacted: "border-brand-500 bg-brand-500/10 text-brand-800",
};

export function QuotationsPanel() {
  const navigate = useNavigate();
  function emailClient(r: any) {
    if (!r.email) { toast.error("No email address for this client."); return; }
    setEmailPrefill({ to: r.email, name: r.name, kind: "quotation", details: `Services: ${(r.main_services ?? []).join(", ") || "—"}${r.budget ? `
Budget: ${r.budget} ${r.currency}` : ""}${r.company ? `
Company: ${r.company}` : ""}` });
    navigate({ to: "/admin", search: { session: "", tab: "gmail" } });
  }
  const [rows, setRows] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState<Date | undefined>();
  const [pending, setPending] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("quotations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error("[quotations] load error", error);
    setRows((data as Quotation[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("admin:quotations")
      .on("postgres_changes", { event: "*", schema: "public", table: "quotations" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (day) {
        const created = new Date(r.created_at);
        if (format(created, "yyyy-MM-dd") !== format(day, "yyyy-MM-dd")) return false;
      }
      if (!q) return true;
      const haystack = [
        r.name, r.company, r.email, r.contact, r.budget, r.currency, r.status,
        ...(r.main_services ?? []), ...(r.sub_categories ?? []),
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, day]);

  function exportCsv() {
    const header = ["Name", "Company", "Email", "Contact", "Main Services", "Sub-categories", "Budget", "Currency", "Status", "Submitted"];
    const lines = filtered.map((r) => [
      r.name,
      r.company ?? "",
      r.email ?? "",
      r.contact ?? "",
      (r.main_services ?? []).join(" | "),
      (r.sub_categories ?? []).join(" | "),
      r.budget ?? "",
      r.currency,
      pending[r.id] ?? r.status,
      new Date(r.created_at).toLocaleString("en-US"),
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "nexen_quotations.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveChanges() {
    const ids = Object.keys(pending);
    if (!ids.length) return;
    setSaving(true);
    try {
      await Promise.all(
        ids.map((id) => {
          const status = pending[id];
          if (!status) return Promise.resolve();
          return supabase.from("quotations").update({ status }).eq("id", id);
        }),
      );
      toast.success("Quotation statuses updated.");
      setPending({});
      await load();
    } catch (err) {
      console.error("[quotations] save error", err);
      toast.error("Couldn't save the changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white text-brand-800">
      <div className="flex flex-wrap items-center gap-2 border-b border-brand-800/15 bg-white px-4 py-3">
        <h2 className="mr-auto text-sm font-semibold text-brand-800">Quotations <span className="font-normal text-brand-800/65">({filtered.length})</span></h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-800/60" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, service…"
            aria-label="Search quotations"
            className="h-9 w-56 border-brand-800/20 bg-white pl-8 text-brand-800 focus-visible:ring-brand-cyan"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1.5 border-brand-800/20 bg-white text-brand-800 hover:bg-brand-500 hover:text-white", day && "border-brand-cyan ring-1 ring-brand-cyan")} aria-label="Filter quotations by date">
              <FlaskConical className="h-3.5 w-3.5" />
              {day ? format(day, "dd MMM yyyy") : "Date filter"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={day} onSelect={setDay} />
            {day && (
              <div className="border-t border-border p-2">
                <Button variant="ghost" size="sm" className="w-full gap-1.5" onClick={() => setDay(undefined)}>
                  <X className="h-3.5 w-3.5" /> Clear
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="sm" className="gap-1.5 border-brand-800/20 bg-white text-brand-800 hover:bg-brand-500 hover:text-white" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" /> Export to Excel
        </Button>
        {Object.keys(pending).length > 0 && (
          <Button size="sm" className="gap-1.5 bg-brand-500 text-white hover:bg-brand-500/90" onClick={saveChanges} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Changes
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-white p-4">
        {loading ? (
          <div className="text-sm text-brand-800/65">Loading quotations…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-brand-800/65">No quotation requests yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-800/15 bg-white">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b border-brand-800/15 bg-white text-left text-xs uppercase tracking-wide text-brand-800">
                <tr>
                  {["Name", "Company", "Email", "Contact", "Main Services", "Sub-categories", "Budget", "Currency", "Status", "Submitted", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2.5 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const status = pending[r.id] ?? r.status;
                  return (
                    <tr key={r.id} className="border-t border-brand-800/10 align-top text-brand-800 transition-colors hover:bg-brand-500/5">
                      <td className="px-3 py-2.5 font-medium">{r.name}</td>
                      <td className="px-3 py-2.5">{r.company ?? "—"}</td>
                      <td className="px-3 py-2.5">{r.email ?? "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.contact ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {(r.main_services ?? []).map((s) => (
                            <Badge key={s} className="border border-brand-cyan bg-brand-cyan/15 font-normal text-brand-800 hover:bg-brand-cyan/20">{s}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex max-w-[260px] flex-wrap gap-1">
                          {(r.sub_categories ?? []).map((s) => (
                            <Badge key={s} variant="outline" className="border-brand-cyan font-normal text-brand-800">{s}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.budget ?? "—"}</td>
                      <td className="px-3 py-2.5">{r.currency}</td>
                      <td className="px-3 py-2.5">
                        <Select
                          value={status}
                          onValueChange={(v) => setPending((p) => ({ ...p, [r.id]: v }))}
                        >
                          <SelectTrigger className={cn("h-8 w-[130px] border", STATUS_STYLES[status])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {QUOTATION_STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-brand-800/65">
                        {new Date(r.created_at).toLocaleString("en-US", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "numeric", minute: "2-digit", hour12: true,
                        })}
                      </td>
                      <td className="px-3 py-2.5">
                        <Button size="sm" variant="outline" disabled={!r.email} onClick={() => emailClient(r)} aria-label={`Email ${r.name}`}
                          className="h-8 gap-1.5 whitespace-nowrap border-brand-500 bg-white text-brand-500 hover:bg-brand-500 hover:text-white">
                          <Mail className="h-3.5 w-3.5" /> Email Client
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
