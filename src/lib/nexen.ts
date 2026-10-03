export const MAIN_SERVICES = [
  "Brand & Design",
  "Web & App Development",
  "Software Solutions",
  "AI & Automation",
  "Marketing & Growth",
  "Media Production",
] as const;

export type MainService = (typeof MAIN_SERVICES)[number];

export const SUB_CATEGORIES: Record<MainService, string[]> = {
  "Brand & Design": [
    "Brand Identity",
    "Logo Design",
    "Visual Identity",
    "Graphic Design",
    "UI/UX Design",
    "Website & Digital Design",
    "Design Systems",
    "Brand Guidelines",
  ],
  "Web & App Development": [
    "Website Development",
    "Web Applications",
    "Mobile Applications",
    "AI Development",
    "WordPress Development",
    "Shopify Development",
    "E-commerce Development",
  ],
  "Software Solutions": [
    "CRM Solutions",
    "CMS Platforms",
    "Business Portals",
    "Custom Software",
    "Dashboards & Management Platforms",
    "Integrations",
    "Workflow Automation",
  ],
  "AI & Automation": [
    "AI Chatbots",
    "AI Assistants",
    "AI Agents",
    "Workflow Automation",
    "Marketing Automation",
    "AI Integrations",
    "Social Media Automation",
    "AI-Powered Data & Insights",
  ],
  "Marketing & Growth": [
    "Social Media Marketing",
    "SEO",
    "Paid Advertising",
    "Content Marketing",
    "Lead Generation",
    "Marketing Automation",
    "Email Marketing",
    "Conversion Rate Optimisation",
  ],
  "Media Production": [
    "Corporate Video",
    "Promotional Video",
    "Product & Service Videos",
    "Photography",
    "Social Media Content",
    "Motion Graphics",
    "Animation",
    "Video Editing",
  ],
};

export const CURRENCIES = ["PKR", "USD", "GBP", "EUR", "AED"] as const;

export const MEETING_SLOTS = [
  "10:00 AM (Pakistan Time)",
  "11:00 AM (Pakistan Time)",
  "12:00 PM (Pakistan Time)",
  "1:00 PM (Pakistan Time)",
  "2:00 PM (Pakistan Time)",
  "3:00 PM (Pakistan Time)",
  "4:00 PM (Pakistan Time)",
  "5:00 PM (Pakistan Time)",
  "6:00 PM (Pakistan Time)",
  "7:00 PM (Pakistan Time)",
] as const;

export const QUOTATION_STATUSES = ["pending", "reviewed", "contacted"] as const;
export const MEETING_STATUSES = ["scheduled", "completed", "cancelled"] as const;

/** dd/mm/yyyy -> Date (local midnight). Returns null when unparseable. */
export function parseDdMmYyyy(value: string): Date | null {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** yyyy-mm-dd (date input) -> dd/mm/yyyy */
export function isoToDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatSessionId(n: number | null | undefined, fallbackId?: string): string {
  if (typeof n === "number" && Number.isFinite(n)) return `NS${String(n).padStart(4, "0")}`;
  return fallbackId ? `Session ${fallbackId.slice(0, 8)}` : "Session";
}
