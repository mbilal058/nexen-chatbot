import { createFileRoute, Link } from "@tanstack/react-router";
import { BookMeetingForm } from "@/components/forms/BookMeetingForm";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/book-meeting")({
  head: () => ({
    meta: [
      { title: "Book a Meeting — Nexen Strategy" },
      {
        name: "description",
        content:
          "Book a strategy call with Nexen Strategy. Pick a date and a Pakistan-time slot and tell us what you'd like to discuss.",
      },
      { property: "og:title", content: "Book a Meeting — Nexen Strategy" },
      {
        property: "og:description",
        content: "Choose a date and time slot for a strategy call with the Nexen Strategy team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookMeetingPage,
});

function BookMeetingPage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Nexen Strategy
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">Book a Meeting</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          A 30-minute call with a senior strategist. Choose a slot that suits you — all times are
          Pakistan Standard Time.
        </p>
        <div className="mt-8">
          <BookMeetingForm />
        </div>
      </div>
    </div>
  );
}
