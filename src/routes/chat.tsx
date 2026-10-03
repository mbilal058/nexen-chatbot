import { createFileRoute } from "@tanstack/react-router";
import { ChatWidget } from "@/components/chat/ChatWidget";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat with Nexen Strategy" },
      {
        name: "description",
        content:
          "Ask the Nexen Strategy assistant about brand, web, software, AI automation, marketing and media — or ask for a human specialist.",
      },
      { property: "og:title", content: "Chat with Nexen Strategy" },
      {
        property: "og:description",
        content: "Instant answers about our services, pricing approach and how we work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  return <ChatWidget />;
}
