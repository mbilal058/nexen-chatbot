import { useEffect, useState } from "react";
import { BarChart3, ExternalLink, Loader2, RefreshCw, Table2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type Workflow = { id: string; title: string; description: string; formUrl: string; sheetUrl: string };

const WORKFLOWS: Workflow[] = [
  {
    id: "search-term",
    title: "Social Media Post Scraper by Search Term",
    description: "Scrape social media posts based on keyword queries.",
    formUrl: "https://sixthtry.app.n8n.cloud/form/24e1d6b3-76e8-4e7c-9827-edee55b6386a",
    sheetUrl:
      "https://docs.google.com/spreadsheets/d/1DsaM392Ntax7DEyOhteMaYt1wPOfYIPXXZe9RzEg7L0/htmlembed?widget=true&headers=false",
  },
  {
    id: "date-location",
    title: "Social Media Post Scraper by Search Term - Date & Location",
    description: "Targeted social media scraper with date range and location filters.",
    formUrl: "https://sixthtry.app.n8n.cloud/form/8637dbad-b1ed-4ba5-b4aa-c687da70ad1e",
    sheetUrl:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTNcvrJGZhTFXNeD-31dKgu_5MRkWEt8yYYskXVK-1PyCPMW9NOThfmnlnG4zuhM5l5aSFYdZN8vt5O/pubhtml",
  },
  {
    id: "competitor-scraper",
    title: "Competitor Insta, LinkedIn, Twitter, FB Profile & Post Scraper",
    description:
      "Scrape competitor profiles and posts across Instagram, LinkedIn, X/Twitter, and Facebook with date range filters for daily competitor monitoring.",
    formUrl: "https://sixthtry.app.n8n.cloud/form/3eff7946-2a2e-44f9-90c2-55e5ddac8e90",
    sheetUrl:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vRczPF7AzpgVgW1Nm5U9itRUnxm4dE5eqhGXPMKyQ8aubpPlNUvMFFc1uDqUFlbQLSNdy2eHawKHryH/pubhtml",
  },
];

const PROCESSING_MS = 90_000;
const btn = "bg-brand-500 text-white hover:bg-brand-cyan hover:text-brand-800 transition-colors";
const outline = "border-brand-800/15 text-brand-800 hover:bg-brand-cyan hover:text-brand-800";

export function AutomationsPanel() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [processingUntil, setProcessingUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const selected = WORKFLOWS.find((w) => w.id === selectedId) ?? null;

  useEffect(() => {
    if (!processingUntil) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= processingUntil) {
        setProcessingUntil(null);
        setFrameKey((k) => k + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [processingUntil]);

  const select = (id: string) => {
    if (id !== selectedId) {
      setProcessingUntil(null);
      setSelectedId(id);
    }
  };

  const remaining = processingUntil ? Math.max(0, Math.ceil((processingUntil - now) / 1000)) : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-white p-4 md:p-6 text-brand-800">
      <h1 className="text-xl font-semibold text-brand-800">Automations</h1>
      <p className="mb-5 text-sm text-brand-800/70">Run n8n workflows and review their results.</p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {WORKFLOWS.map((w) => {
          const active = w.id === selectedId;
          return (
            <div
              key={w.id}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onClick={() => select(w.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(w.id);
                }
              }}
              className={`flex cursor-pointer flex-col rounded-xl border bg-white p-5 shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ${
                active ? "border-2 border-brand-500 bg-brand-500/5 shadow-md" : "border-brand-800/10 hover:border-brand-500/40"
              }`}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
                <Zap className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-brand-800">{w.title}</h2>
              <p className="mt-1 flex-1 text-sm text-brand-800/70">{w.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className={btn} onClick={(e) => e.stopPropagation()}>
                  <a href={w.formUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" /> Run Workflow
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className={outline}
                  onClick={(e) => {
                    e.stopPropagation();
                    select(w.id);
                  }}
                >
                  <Table2 className="h-4 w-4" /> View Results
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-brand-800/10 bg-white p-4 shadow-sm">
        {!selected ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/10 text-brand-500">
              <BarChart3 className="h-7 w-7" />
            </div>
            <p className="text-sm text-brand-800/70">Select a workflow above to view its scraping results.</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-brand-800">Viewing Results: {selected.title}</h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className={outline}
                  onClick={() =>
                    processingUntil ? setProcessingUntil(null) : setProcessingUntil(Date.now() + PROCESSING_MS)
                  }
                >
                  {processingUntil ? "Stop Processing" : "Mark as Processing"}
                </Button>
                <Button className={btn} onClick={() => setFrameKey((k) => k + 1)}>
                  <RefreshCw className="h-4 w-4" /> Refresh Results
                </Button>
              </div>
            </div>
            {processingUntil && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-brand-amber/40 bg-brand-amber/10 px-3 py-2 text-sm text-brand-800">
                <Loader2 className="h-4 w-4 animate-spin text-brand-amber" />
                Scraping in progress... ⏳ ({Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")} left — results refresh automatically)
              </div>
            )}
            <iframe
              key={`${selected.id}-${frameKey}`}
              src={selected.sheetUrl}
              title={`Results: ${selected.title}`}
              className="block h-[calc(100vh-360px)] min-h-[600px] w-full rounded-lg border-0"
            />
          </>
        )}
      </div>
    </div>
  );
}
