import { createFileRoute } from "@tanstack/react-router";
import { ChatWidget } from "@/components/chat/ChatWidget";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexen Strategy — Digital Agency & AI Solutions" },
      {
        name: "description",
        content:
          "Nexen Strategy builds brands, websites, software, AI automation, growth marketing and media for ambitious companies. Request a quotation or book a strategy meeting.",
      },
      { property: "og:title", content: "Nexen Strategy — Digital Agency & AI Solutions" },
      {
        property: "og:description",
        content:
          "Brand & design, web & app development, software, AI automation, marketing and media production — delivered by one senior team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return <main className="min-h-[100dvh] bg-background"><ChatWidget /></main>;
}
