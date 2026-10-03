import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const UuidSchema = z.string().uuid();

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Fetches a URL and extracts clean descriptive text from headings, paragraphs
 * and list items — dropping scripts, styles, navs, headers, footers, asides.
 */
function extractCleanText(html: string): string {
  let s = html;
  // Strip whole blocks we never want.
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ");
  s = s.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ");
  s = s.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ");
  s = s.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ");
  s = s.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ");
  s = s.replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, " ");
  s = s.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");

  // Collect the descriptive tags we care about, in document order.
  const pieces: string[] = [];
  const re = /<(h1|h2|h3|h4|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const inner = m[2]
      .replace(/<[^>]+>/g, " ") // strip any nested tags
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (inner) pieces.push(inner);
  }
  return pieces.join("\n");
}

export const listBotKnowledge = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("bot_knowledge")
    .select("id, bot_id, source_type, raw_text, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const ingestUrlKnowledge = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string; botId?: string }) =>
    z
      .object({ url: z.string().url(), botId: UuidSchema.optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    let res: Response;
    const readerUrl = `https://r.jina.ai/${data.url}`;
    try {
      res = await fetch(readerUrl, {
        headers: {
          "User-Agent": "NexenStrategyBot/1.0",
          Accept: "text/plain, text/markdown, */*",
        },
        redirect: "follow",
      });
    } catch (err) {
      throw new Error(`Failed to fetch URL via Jina Reader: ${(err as Error).message}`);
    }
    if (!res.ok) throw new Error(`Jina Reader fetch failed with status ${res.status}`);
    const markdown = (await res.text()).trim();
    if (!markdown) throw new Error("No readable content returned by Jina Reader for that URL.");
    const clean = markdown.slice(0, 500_000);

    const supabase = await admin();
    const { data: row, error } = await supabase
      .from("bot_knowledge")
      .insert({
        source_type: "url",
        raw_text: clean,
        ...(data.botId ? { bot_id: data.botId } : {}),
      })
      .select("id, bot_id, source_type, raw_text, created_at, updated_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to save knowledge");
    return row;
  });

export const ingestFileKnowledge = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { fileName: string; content: string; botId?: string }) =>
      z
        .object({
          fileName: z.string().trim().min(1).max(255),
          content: z.string().trim().min(1).max(500_000),
          botId: UuidSchema.optional(),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const ext = data.fileName.toLowerCase().split(".").pop() ?? "";
    const allowed = ["txt", "md", "markdown", "text"];
    if (!allowed.includes(ext)) {
      throw new Error("Only .txt or .md files are supported.");
    }
    const supabase = await admin();
    const source_type = ext === "md" || ext === "markdown" ? "file" : "file";
    const { data: row, error } = await supabase
      .from("bot_knowledge")
      .insert({
        source_type,
        raw_text: data.content,
        ...(data.botId ? { bot_id: data.botId } : {}),
      })
      .select("id, bot_id, source_type, raw_text, created_at, updated_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to save knowledge");
    return row;
  });

export const deleteBotKnowledge = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) =>
    z.object({ id: UuidSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = await admin();
    const { error } = await supabase.from("bot_knowledge").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });