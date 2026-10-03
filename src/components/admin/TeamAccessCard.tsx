import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteTeamMember, listTeamMembers, revokeTeamMember } from "@/lib/admin-invite.functions";

type Member = { userId: string; role: "admin" | "staff" | "none"; email: string; pending: boolean; isYou: boolean };

export function TeamAccessCard() {
  const list = useServerFn(listTeamMembers);
  const invite = useServerFn(inviteTeamMember);
  const revoke = useServerFn(revokeTeamMember);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("admin");
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  async function refresh() {
    try { setMembers(await list()); } catch { setDenied(true); }
  }
  useEffect(() => { void refresh(); }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await invite({ data: { email, role, redirectTo: `${window.location.origin}/set-password` } });
      toast.success(r.existing ? `${email} already has an account — a password link was emailed and access granted.` : `Invitation sent to ${email}.`);
      setEmail("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send invitation");
    } finally { setBusy(false); }
  }

  async function remove(m: Member) {
    if (!confirm(`Permanently delete ${m.email} and remove their dashboard access?`)) return;
    try {
      await revoke({ data: { userId: m.userId } });
      toast.success(`${m.email} was deleted`);
      setMembers((list) => list?.filter((x) => x.userId !== m.userId) ?? null);
      await refresh();
    }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  if (denied) return null;

  return (
    <div className="rounded-xl border border-brand-800/15 bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold text-brand-800">
        <Users className="h-4 w-4" /> Team Access
      </h2>
      <p className="mb-4 text-sm text-brand-800/60">
        Invite someone by email. They'll receive a link to set their own password and sign in to this dashboard.
      </p>
      <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row">
        <Input type="email" required placeholder="name@nexenstrategy.com" value={email}
          onChange={(e) => setEmail(e.target.value)} className="flex-1" />
        <Select value={role} onValueChange={(v) => setRole(v as "admin" | "staff")}>
          <SelectTrigger className="sm:w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={busy} className="gap-1.5 bg-brand-500 text-white hover:bg-brand-800">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Send Invite
        </Button>
      </form>
      <div className="mt-4 divide-y divide-brand-800/10 rounded-lg border border-brand-800/15">
        {members === null ? (
          <div className="p-3 text-sm text-brand-800/60">Loading…</div>
        ) : members.length === 0 ? (
          <div className="p-3 text-sm text-brand-800/60">No team members yet.</div>
        ) : members.map((m) => (
          <div key={m.userId + m.role} className="flex items-center justify-between gap-2 p-3 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium text-brand-800">{m.email}{m.isYou && " (you)"}</div>
              <div className="flex gap-1.5 pt-0.5">
                <span className="rounded-full bg-brand-cyan/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-800">{m.role === "none" ? "No access" : m.role}</span>
                {m.pending && <span className="rounded-full bg-brand-amber/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-800">Invite pending</span>}
              </div>
            </div>
            {!m.isYou && (
              <Button variant="ghost" size="icon" onClick={() => remove(m)} aria-label="Remove access"
                className="text-brand-red hover:bg-brand-red hover:text-white">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
