export type EmailPrefill = {
  to: string;
  name?: string;
  kind: "meeting" | "quotation";
  details?: string;
};

const KEY = "nexen_email_prefill";

export function setEmailPrefill(p: EmailPrefill) {
  sessionStorage.setItem(KEY, JSON.stringify(p));
}

export function takeEmailPrefill(): EmailPrefill | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    return JSON.parse(raw) as EmailPrefill;
  } catch {
    return null;
  }
}
