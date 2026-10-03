import { createFileRoute, Link } from "@tanstack/react-router";
import { QuotationForm } from "@/components/forms/QuotationForm";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/quote")({
  head: () => ({
    meta: [
      { title: "Request a Quotation — Nexen Strategy" },
      {
        name: "description",
        content:
          "Tell us what you need across brand, web, software, AI automation, marketing and media — and get a tailored quotation from Nexen Strategy.",
      },
      { property: "og:title", content: "Request a Quotation — Nexen Strategy" },
      {
        property: "og:description",
        content: "Share your services, sub-categories and budget and we'll send a tailored quotation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuotePage,
});

function QuotePage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Nexen Strategy
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">Request a Quotation</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Pick the services you're interested in, add the relevant sub-categories and your budget.
          We'll come back with scope, timeline and pricing.
        </p>
        <div className="mt-8">
          <QuotationForm />
        </div>
      </div>
    </div>
  );
}
