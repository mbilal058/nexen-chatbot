import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/set-password")({
  head: () => ({
    meta: [
      { title: "Set Your Password — Nexen Strategy" },
      { name: "description", content: "Accept your Nexen Strategy dashboard invitation and choose a password." },
      { property: "og:title", content: "Set Your Password — Nexen Strategy" },
      { property: "og:description", content: "Accept your Nexen Strategy dashboard invitation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"wait" | "ok" | "invalid">("wait");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    const accept = (e?: string | null) => { if (!done) { done = true; setEmail(e ?? ""); setReady("ok"); } };
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => { if (s) accept(s.user.email); });
    void supabase.auth.getSession().then(({ data }) => { if (data.session) accept(data.session.user.email); });
    const t = setTimeout(() => { if (!done) setReady("invalid"); }, 4000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw !== pw2) return setErr("Passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    navigate({ to: "/admin" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-brand-800/15 bg-white p-6 shadow-lg">
        <h1 className="text-lg font-semibold text-brand-800">Set your password</h1>
        {ready === "wait" && <p className="text-sm text-brand-800/60">Checking your invitation…</p>}
        {ready === "invalid" && (
          <p className="text-sm text-brand-800/70">
            This invitation link is invalid or has expired. Ask an admin to send a new invite.
          </p>
        )}
        {ready === "ok" && (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-brand-800/60">Welcome{email ? `, ${email}` : ""}. Choose a password to finish setting up your dashboard access.</p>
            <div className="space-y-1">
              <Label htmlFor="pw">New password</Label>
              <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pw2">Confirm password</Label>
              <Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} />
            </div>
            {err && <p className="text-xs text-brand-red">{err}</p>}
            <Button type="submit" disabled={busy} className="w-full bg-brand-500 text-white hover:bg-brand-800">
              {busy ? "Saving…" : "Save password & open dashboard"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
