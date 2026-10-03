import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { setEmailPrefill } from "@/lib/email-prefill";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MAIN_SERVICES, MEETING_SLOTS, MEETING_STATUSES, parseDdMmYyyy } from "@/lib/nexen";
import { CalendarPlus, Download, FlaskConical, Loader2, Mail, Search, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type Meeting = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  contact: string | null;
  services: string[] | null;
  date: string;
  time: string;
  status: string;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: "border-brand-cyan bg-brand-cyan/15 text-brand-800",
  completed: "border-brand-500 bg-brand-500/10 text-brand-800",
  cancelled: "border-brand-red bg-brand-red/10 text-brand-red",
};

export function MeetingsPanel() {
  const navigate = useNavigate();
  function emailClient(r: any) {
    if (!r.email) { toast.error("No email address for this client."); return; }
    setEmailPrefill({ to: r.email, name: r.name, kind: "meeting", details: `Meeting: ${r.date} at ${r.time}${r.services?.length ? `
Services: ${r.services.join(", ")}` : ""}${r.company ? `
Company: ${r.company}` : ""}` });
    navigate({ to: "/admin", search: { session: "", tab: "gmail" } });
  }
  const [rows, setRows] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState<Date | undefined>();
  const [pending, setPending] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [bName, setBName] = useState("");
  const [bCompany, setBCompany] = useState("");
  const [bEmail, setBEmail] = useState("");
  const [bContact, setBContact] = useState("");
  const [bServices, setBServices] = useState<string[]>([]);
  const [bDate, setBDate] = useState<Date | undefined>();
  const [bTime, setBTime] = useState("");
  const [booking, setBooking] = useState(false);
  const [rescheduleRow, setRescheduleRow] = useState<Meeting | null>(null);
  const [rDate, setRDate] = useState<Date | undefined>();
  const [rTime, setRTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error("[meetings] load error", error);
    const list = (data as Meeting[]) ?? [];

    // Auto-cancel meetings whose date has passed but are still scheduled.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const stale = list.filter((m) => {
      if (m.status !== "scheduled") return false;
      const d = parseDdMmYyyy(m.date);
      return d !== null && d < todayStart;
    });
    if (stale.length) {
      await Promise.all(
        stale.map((m) => supabase.from("meetings").update({ status: "cancelled" }).eq("id", m.id)),
      );
      stale.forEach((m) => { m.status = "cancelled"; });
    }
    setRows(list);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("admin:meetings")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (day) {
        const d = parseDdMmYyyy(r.date);
        if (!d || format(d, "yyyy-MM-dd") !== format(day, "yyyy-MM-dd")) return false;
      }
      if (!q) return true;
      const haystack = [r.name, r.company, r.email, r.contact, r.date, r.time, r.status, ...(r.services ?? [])]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, day]);

  function exportCsv() {
    const header = ["Name", "Company", "Email", "Contact", "Services", "Date", "Time", "Status", "Booked At"];
    const lines = filtered.map((r) => [
      r.name, r.company ?? "", r.email ?? "", r.contact ?? "",
      (r.services ?? []).join(" | "), r.date, r.time,
      pending[r.id] ?? r.status,
      new Date(r.created_at).toLocaleString("en-US"),
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "nexen_meetings.csv";
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
          return supabase.from("meetings").update({ status }).eq("id", id);
        }),
      );
      toast.success("Meeting statuses updated.");
      setPending({});
      await load();
    } catch (err) {
      console.error("[meetings] save error", err);
      toast.error("Couldn't save the changes.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBooking() {
    if (!bName.trim() || !bEmail.trim() || !bContact.trim() || !bDate || !bTime || bServices.length === 0) {
      toast.error("Please complete every field and pick at least one service.");
      return;
    }
    setBooking(true);
    try {
      const { error } = await supabase.from("meetings").insert({
        name: bName.trim(),
        company: bCompany.trim() || null,
        email: bEmail.trim(),
        contact: bContact.trim(),
        services: bServices,
        date: format(bDate, "dd/MM/yyyy"),
        time: bTime,
        status: "scheduled",
      });
      if (error) throw error;
      toast.success("Meeting booked.");
      setBookOpen(false);
      setBName(""); setBCompany(""); setBEmail(""); setBContact("");
      setBServices([]); setBDate(undefined); setBTime("");
      await load();
    } catch (err) {
      console.error("[meetings] book error", err);
      toast.error("Couldn't book the meeting.");
    } finally {
      setBooking(false);
    }
  }

  async function confirmReschedule() {
    if (!rescheduleRow || !rDate || !rTime) {
      toast.error("Pick a new date and time.");
      return;
    }
    setRescheduling(true);
    try {
      const { error } = await supabase
        .from("meetings")
        .update({ date: format(rDate, "dd/MM/yyyy"), time: rTime, status: "scheduled" })
        .eq("id", rescheduleRow.id);
      if (error) throw error;
      toast.success("Meeting rescheduled.");
      setRescheduleRow(null);
      setRDate(undefined);
      setRTime("");
      await load();
    } catch (err) {
      console.error("[meetings] reschedule error", err);
      toast.error("Couldn't reschedule the meeting.");
    } finally {
      setRescheduling(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white text-brand-800">
      <div className="flex flex-wrap items-center gap-2 border-b border-brand-800/15 bg-white px-4 py-3">
        <h2 className="mr-auto text-sm font-semibold text-brand-800">Meetings <span className="font-normal text-brand-800/65">({filtered.length})</span></h2>
        <Button size="sm" className="gap-1.5 bg-brand-500 text-white hover:bg-brand-500/90" onClick={() => setBookOpen(true)} aria-label="Book a new meeting">
          <CalendarPlus className="h-3.5 w-3.5" /> Book Meeting
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-800/60" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, service…"
            aria-label="Search meetings"
            className="h-9 w-56 border-brand-800/20 bg-white pl-8 text-brand-800 focus-visible:ring-brand-cyan"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1.5 border-brand-800/20 bg-white text-brand-800 hover:bg-brand-500 hover:text-white", day && "border-brand-cyan ring-1 ring-brand-cyan")} aria-label="Filter meetings by date">
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
          <div className="text-sm text-brand-800/65">Loading meetings…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-brand-800/65">No meetings booked yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-800/15 bg-white">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="border-b border-brand-800/15 bg-white text-left text-xs uppercase tracking-wide text-brand-800">
                <tr>
                  {["Name", "Company", "Email", "Contact", "Services", "Date", "Time", "Status", "Booked At", ""].map((h) => (
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
                        <div className="flex max-w-[240px] flex-wrap gap-1">
                          {(r.services ?? []).map((s) => (
                            <Badge key={s} className="border border-brand-cyan bg-brand-cyan/15 font-normal text-brand-800 hover:bg-brand-cyan/20">{s}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.date}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.time}</td>
                      <td className="px-3 py-2.5">
                        <Select value={status} onValueChange={(v) => {
                          if (v === "reschedule") {
                            setRescheduleRow(r);
                            setRDate(parseDdMmYyyy(r.date) ?? undefined);
                            setRTime(r.time);
                            return;
                          }
                          setPending((p) => ({ ...p, [r.id]: v }));
                        }}>
                          <SelectTrigger className={cn("h-8 w-[130px] border", STATUS_STYLES[status])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEETING_STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                            ))}
                            <SelectItem value="reschedule" className="font-medium text-brand-500">Reschedule…</SelectItem>
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

      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-white text-brand-800 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-brand-800">Book Meeting</DialogTitle>
            <DialogDescription className="text-brand-800/65">
              Book a new meeting on a client's behalf.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="b-name" className="text-xs font-medium text-brand-800/65">Full Name</Label>
                <Input id="b-name" value={bName} onChange={(e) => setBName(e.target.value)} maxLength={120} className="border-brand-800/20 bg-white text-brand-800 focus-visible:ring-brand-cyan" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="b-company" className="text-xs font-medium text-brand-800/65">Company Name</Label>
                <Input id="b-company" value={bCompany} onChange={(e) => setBCompany(e.target.value)} maxLength={140} className="border-brand-800/20 bg-white text-brand-800 focus-visible:ring-brand-cyan" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="b-email" className="text-xs font-medium text-brand-800/65">Email Address</Label>
                <Input id="b-email" type="email" value={bEmail} onChange={(e) => setBEmail(e.target.value)} maxLength={200} className="border-brand-800/20 bg-white text-brand-800 focus-visible:ring-brand-cyan" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="b-contact" className="text-xs font-medium text-brand-800/65">Contact Number</Label>
                <Input id="b-contact" type="tel" value={bContact} onChange={(e) => setBContact(e.target.value)} maxLength={40} className="border-brand-800/20 bg-white text-brand-800 focus-visible:ring-brand-cyan" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold text-brand-800">Services</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {MAIN_SERVICES.map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-2 rounded-md border border-brand-800/15 bg-white px-3 py-2 text-sm text-brand-800 transition-colors hover:border-brand-500/60">
                    <Checkbox
                      checked={bServices.includes(s)}
                      onCheckedChange={() => setBServices((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}
                    />
                    <span className="min-w-0 break-words">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-brand-800/65">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start gap-1.5 border-brand-800/20 bg-white text-brand-800 hover:bg-brand-500/5", !bDate && "text-brand-800/50")}>
                      <CalendarPlus className="h-3.5 w-3.5" />
                      {bDate ? format(bDate, "dd MMM yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={bDate} onSelect={setBDate} className="pointer-events-auto p-3" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-brand-800/65">Time</Label>
                <Select value={bTime} onValueChange={setBTime}>
                  <SelectTrigger className="border-brand-800/20 bg-white text-brand-800">
                    <SelectValue placeholder="Select a time slot" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {MEETING_SLOTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full gap-2 bg-brand-500 text-white hover:bg-brand-500/90" onClick={saveBooking} disabled={booking}>
              {booking && <Loader2 className="h-4 w-4 animate-spin" />}
              {booking ? "Booking…" : "Book Meeting"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rescheduleRow} onOpenChange={(open) => { if (!open) setRescheduleRow(null); }}>
        <DialogContent className="bg-white text-brand-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-brand-800">Reschedule Meeting</DialogTitle>
            <DialogDescription className="text-brand-800/65">
              Pick a new date and time for {rescheduleRow?.name}. The status will be set back to Scheduled.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Calendar mode="single" selected={rDate} onSelect={setRDate} className="pointer-events-auto mx-auto rounded-md border border-brand-800/15 p-3" />
            <Select value={rTime} onValueChange={setRTime}>
              <SelectTrigger className="border-brand-800/20 bg-white text-brand-800">
                <SelectValue placeholder="Select a time slot" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {MEETING_SLOTS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full gap-2 bg-brand-500 text-white hover:bg-brand-500/90" onClick={confirmReschedule} disabled={rescheduling}>
              {rescheduling && <Loader2 className="h-4 w-4 animate-spin" />}
              {rescheduling ? "Saving…" : "Confirm Reschedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
