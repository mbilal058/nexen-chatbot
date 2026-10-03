import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MAIN_SERVICES, MEETING_SLOTS, isoToDdMmYyyy, type MainService } from "@/lib/nexen";
import { CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function BookMeetingForm({ compact = false }: { compact?: boolean }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [services, setServices] = useState<MainService[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  function toggleService(s: MainService) {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim() || !email.trim() || !contact.trim() || !date || !time || services.length === 0) {
      setError("Please complete every field and pick at least one service.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("meetings").insert({
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim(),
        contact: contact.trim(),
        services,
        date: isoToDdMmYyyy(date),
        time,
        status: "scheduled",
      });
      if (insertError) throw insertError;
      setDone(true);
      toast.success("Meeting booked — check your inbox for the details.");
    } catch (err) {
      console.error("[BookMeetingForm] submit failed", err);
      setError("We couldn't book that slot. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className={cn("flex flex-col items-center gap-3 rounded-lg border border-border bg-card text-center", compact ? "p-5" : "p-10")}>
        <CalendarCheck className="h-10 w-10 text-primary" />
        <h2 className="text-xl font-semibold">Meeting scheduled</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Thanks {name.split(" ")[0]} — we've reserved {isoToDdMmYyyy(date)} at {time}. Our team will
          confirm shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex min-w-0 flex-col overflow-x-hidden bg-card", compact ? "gap-4 p-3" : "gap-6 rounded-lg border border-border p-5 sm:p-8")}>
      <div className={cn("grid gap-4", !compact && "sm:grid-cols-2")}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-name" className="text-xs font-medium text-muted-foreground">Full Name</Label>
          <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-company" className="text-xs font-medium text-muted-foreground">Company Name</Label>
          <Input id="m-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={140} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-email" className="text-xs font-medium text-muted-foreground">Email Address</Label>
          <Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-contact" className="text-xs font-medium text-muted-foreground">Contact Number</Label>
          <Input id="m-contact" type="tel" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={40} required />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-sm font-semibold">What would you like to discuss?</div>
        <div className={cn("grid gap-2", !compact && "sm:grid-cols-2")}>
          {MAIN_SERVICES.map((s) => (
            <label
              key={s}
              className="flex min-w-0 cursor-pointer items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-sm transition-colors hover:border-primary/60"
            >
              <Checkbox checked={services.includes(s)} onCheckedChange={() => toggleService(s)} />
               <span className="min-w-0 break-words">{s}</span>
            </label>
          ))}
        </div>
      </div>

      <div className={cn("grid gap-4", !compact && "sm:grid-cols-2")}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-date" className="text-xs font-medium text-muted-foreground">Preferred Date</Label>
          <Input id="m-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="m-time" className="text-xs font-medium text-muted-foreground">Meeting Time</Label>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger id="m-time">
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

      {error && <div className="text-sm text-destructive">{error}</div>}

      <Button type="submit" size="lg" disabled={submitting} className="w-full gap-2 whitespace-normal">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Booking…" : "Book Meeting"}
      </Button>
    </form>
  );
}
