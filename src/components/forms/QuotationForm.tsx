import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CURRENCIES, MAIN_SERVICES, SUB_CATEGORIES, type MainService } from "@/lib/nexen";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function QuotationForm({ compact = false }: { compact?: boolean }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [services, setServices] = useState<MainService[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState<string>("PKR");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSubs = useMemo(
    () => services.map((s) => ({ service: s, items: SUB_CATEGORIES[s] })),
    [services],
  );

  function toggleService(s: MainService) {
    setServices((prev) => {
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
      // Drop sub-categories whose parent service is no longer selected.
      const allowed = new Set(next.flatMap((x) => SUB_CATEGORIES[x]));
      setSubs((cur) => cur.filter((c) => allowed.has(c)));
      return next;
    });
  }

  function toggleSub(item: string) {
    setSubs((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim() || !email.trim() || !contact.trim() || services.length === 0) {
      setError("Please add your name, email, contact number and at least one service.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("quotations").insert({
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim(),
        contact: contact.trim(),
        main_services: services,
        sub_categories: subs,
        budget: budget.trim() || null,
        currency,
        status: "pending",
      });
      if (insertError) throw insertError;
      setDone(true);
      toast.success("Quotation request received — our team will be in touch shortly.");
    } catch (err) {
      console.error("[QuotationForm] submit failed", err);
      setError("We couldn't send your request. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className={cn("flex flex-col items-center gap-3 rounded-lg border border-border bg-card text-center", compact ? "p-5" : "p-10")}>
        <CheckCircle2 className="h-10 w-10 text-primary" />
        <h2 className="text-xl font-semibold">Request received</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Thanks {name.split(" ")[0]} — a Nexen Strategy specialist will review your brief and reply
          with a tailored quotation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex min-w-0 flex-col overflow-x-hidden bg-card", compact ? "gap-4 p-3" : "gap-6 rounded-lg border border-border p-5 sm:p-8")}>
      <div className={cn("grid gap-4", !compact && "sm:grid-cols-2")}>
        <Field label="Full Name" id="q-name">
          <Input id="q-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </Field>
        <Field label="Company Name" id="q-company">
          <Input id="q-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={140} />
        </Field>
        <Field label="Email Address" id="q-email">
          <Input id="q-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} required />
        </Field>
        <Field label="Contact Number" id="q-contact">
          <Input id="q-contact" type="tel" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={40} required />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-sm font-semibold">Main Services</div>
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

      {availableSubs.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="text-sm font-semibold">Sub-Categories</div>
          {availableSubs.map(({ service, items }) => (
            <div key={service} className="min-w-0 rounded-md border border-border bg-background p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {service}
              </div>
              <div className={cn("grid gap-2", !compact && "sm:grid-cols-2 lg:grid-cols-3")}>
                {items.map((item) => (
                  <label key={`${service}-${item}`} className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <Checkbox checked={subs.includes(item)} onCheckedChange={() => toggleSub(item)} />
                    <span className="min-w-0 break-words">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={cn("grid gap-4", !compact && "sm:grid-cols-[1fr_180px]")}>
        <Field label="Budget Amount" id="q-budget">
          <Input
            id="q-budget"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g. 250,000"
            maxLength={40}
          />
        </Field>
        <Field label="Currency" id="q-currency">
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="q-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <Button type="submit" size="lg" disabled={submitting} className="w-full gap-2 whitespace-normal">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Sending request…" : "Request Quotation"}
      </Button>
    </form>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
