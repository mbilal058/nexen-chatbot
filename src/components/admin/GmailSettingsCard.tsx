import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Mail, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGmailStatus } from "@/lib/gmail.functions";

export function GmailSettingsCard() {
  const check = useServerFn(getGmailStatus);
  const [state, setState] = useState<{ loading: boolean; connected: boolean; email: string | null }>({
    loading: true, connected: false, email: null,
  });

  async function refresh() {
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await check();
      setState({ loading: false, connected: r.connected, email: r.email });
    } catch {
      setState({ loading: false, connected: false, email: null });
    }
  }
  useEffect(() => { void refresh(); }, []);

  return (
    <div className="rounded-xl border border-brand-800/15 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-brand-800">
            <Mail className="h-4 w-4" /> Gmail API Integration
          </h2>
          <p className="text-sm text-brand-800/60">
            Emails from the Gmail tab are sent through the official Google Workspace / Gmail API using a secure OAuth2 connection.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={state.loading}
          className="gap-1.5 border-brand-800/20 bg-white text-brand-800 hover:bg-brand-500 hover:text-white">
          {state.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Test Connection
        </Button>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-brand-800/15 p-3 text-sm">
        {state.loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
        ) : state.connected ? (
          <CheckCircle2 className="h-4 w-4 text-brand-500" />
        ) : (
          <XCircle className="h-4 w-4 text-brand-red" />
        )}
        <div>
          <p className="font-medium text-brand-800">
            {state.loading ? "Checking…" : state.connected ? "Connected" : "Not connected"}
          </p>
          <p className="text-xs text-brand-800/60">
            {state.connected ? `Sending as ${state.email}` : "Reconnect the Google account to enable sending."}
          </p>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-brand-800/60">
        <ShieldCheck className="h-3.5 w-3.5 text-brand-cyan" />
        OAuth2 credentials are stored securely on the server and never exposed in the browser.
      </p>
    </div>
  );
}
