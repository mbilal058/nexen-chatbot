import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";

// Client-safe module — never top-level import server-only clients here.

const LangSchema = z.enum(["en", "roman"]);
const UuidSchema = z.string().uuid();
const ContentSchema = z.string().trim().min(1).max(2000);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function verifySession(sessionId: string, accessToken: string) {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("chats")
    .select("id, status, user_language, access_token, is_ai_enabled, session_number")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.access_token !== accessToken) return null;
  return data;
}

export const createChatSession = createServerFn({ method: "POST" })
  .inputValidator((input: { language: "en" | "roman" }) =>
    z.object({ language: LangSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = await admin();
    const { data: row, error } = await supabase
      .from("chats")
      .insert({ user_language: data.language, status: "bot" })
      .select("id, access_token, status, session_number")
      .single();
    if (error || !row) throw new Error("Failed to create session");
    return { sessionId: row.id as string, accessToken: row.access_token as string, status: row.status as string, sessionNumber: row.session_number as number };
  });

export const getChatSession = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string; accessToken: string }) =>
    z.object({ sessionId: UuidSchema, accessToken: UuidSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const session = await verifySession(data.sessionId, data.accessToken);
    if (!session) return null;
    return { id: session.id, status: session.status, user_language: session.user_language, sessionNumber: session.session_number };
  });

export const listChatMessages = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string; accessToken: string }) =>
    z.object({ sessionId: UuidSchema, accessToken: UuidSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const session = await verifySession(data.sessionId, data.accessToken);
    if (!session) throw new Error("Invalid session");
    const supabase = await admin();
    const { data: rows, error } = await supabase
      .from("messages")
      .select("id, sender, content, created_at")
      .eq("chat_id", data.sessionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error("Failed to load messages");
    return rows ?? [];
  });

export const sendUserMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { sessionId: string; accessToken: string; content: string; resumed?: boolean }) =>
      z
        .object({ sessionId: UuidSchema, accessToken: UuidSchema, content: ContentSchema, resumed: z.boolean().optional() })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await verifySession(data.sessionId, data.accessToken);
    if (!session) throw new Error("Invalid session");
    const supabase = await admin();
    if (data.resumed) await insertResumeMarker(data.sessionId);
    const { data: row, error } = await supabase
      .from("messages")
      .insert({ chat_id: data.sessionId, sender: "user", content: data.content })
      .select("id, sender, content, created_at")
      .single();
    if (error || !row) throw new Error("Failed to send message");
    await supabase
      .from("chats")
      .update({ updated_at: new Date().toISOString(), last_message_at: row.created_at })
      .eq("id", data.sessionId);
    return row;
  });

export const RESUME_MARKER = "Visitor returned after clearing chat";

async function insertResumeMarker(chatId: string) {
  const supabase = await admin();
  await supabase.from("messages").insert({ chat_id: chatId, sender: "system", content: RESUME_MARKER });
}

export const persistBotMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { sessionId: string; accessToken: string; content: string; sender?: "bot" | "system" }) =>
      z
        .object({
          sessionId: UuidSchema,
          accessToken: UuidSchema,
          content: ContentSchema,
          sender: z.enum(["bot", "system"]).optional().default("bot"),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await verifySession(data.sessionId, data.accessToken);
    if (!session) throw new Error("Invalid session");
    const supabase = await admin();
    const { data: row, error } = await supabase
      .from("messages")
      .insert({ chat_id: data.sessionId, sender: data.sender, content: data.content })
      .select("id, sender, content, created_at")
      .single();
    if (error || !row) throw new Error("Failed to save bot message");
    await supabase
      .from("chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.sessionId);
    return row;
  });

export const requestHumanHandoff = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { sessionId: string; accessToken: string; systemMessage: string }) =>
      z
        .object({
          sessionId: UuidSchema,
          accessToken: UuidSchema,
          systemMessage: z.string().trim().min(1).max(500),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await verifySession(data.sessionId, data.accessToken);
    if (!session) throw new Error("Invalid session");
    const supabase = await admin();
    const requestedAt = new Date().toISOString();
    const { error: messageError } = await supabase
      .from("messages")
      .insert({ chat_id: data.sessionId, sender: "system", content: data.systemMessage });
    if (messageError) throw new Error("Failed to record handoff request");
    const { error: updateError } = await supabase
      .from("chats")
      .update({
        status: "human",
        is_ai_enabled: false,
        is_handoff_triggered: true,
        handoff_submitted_at: requestedAt,
        updated_at: requestedAt,
      })
      .eq("id", data.sessionId);
    if (updateError) throw new Error("Failed to start human handoff");
    const { routeHandoffToWhatsApp } = await import("@/lib/whatsapp.server");
    const whatsapp = await routeHandoffToWhatsApp(data.sessionId);
    return { ok: true, whatsapp };
  });

const TopicSchema = z.enum(["Brand & Design", "Web & App Development", "Software Solutions", "AI & Automation", "Marketing & Growth", "Media Production", "Quotation", "Meeting", "Others"]);

export const submitHandoffForm = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      sessionId: string;
      accessToken: string;
      username: string;
      topic: string;
      queries: string;
      confirmationMessage: string;
    }) =>
      z
        .object({
          sessionId: UuidSchema,
          accessToken: UuidSchema,
          username: z.string().trim().min(1).max(100),
          topic: TopicSchema,
          queries: z.string().trim().min(1).max(2000),
          confirmationMessage: z.string().trim().min(1).max(500),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await verifySession(data.sessionId, data.accessToken);
    if (!session) throw new Error("Invalid session");
    const supabase = await admin();
    const submittedAt = new Date().toISOString();
    await supabase
      .from("chats")
      .update({
        status: "human",
        is_ai_enabled: false,
        handoff_username: data.username,
        handoff_topic: data.topic,
        handoff_queries: data.queries,
        handoff_submitted_at: submittedAt,
        updated_at: submittedAt,
      })
      .eq("id", data.sessionId);
    await supabase.from("messages").insert([
      {
        chat_id: data.sessionId,
        sender: "system",
        content: `Handoff form submitted — Name: ${data.username} · Topic: ${data.topic} · Query: ${data.queries}`,
      },
      { chat_id: data.sessionId, sender: "system", content: data.confirmationMessage },
    ]);
    return { ok: true };
  });

export const closeChatSession = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string; accessToken: string; systemMessage?: string }) =>
    z.object({
      sessionId: UuidSchema,
      accessToken: UuidSchema,
      systemMessage: z.string().trim().min(1).max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const session = await verifySession(data.sessionId, data.accessToken);
    if (!session) throw new Error("Invalid session");
    const supabase = await admin();
    const now = new Date().toISOString();
    if (data.systemMessage) {
      await supabase.from("messages").insert({
        chat_id: data.sessionId,
        sender: "system",
        content: data.systemMessage,
      });
    }
    await supabase
      .from("chats")
      .update({ status: "closed", updated_at: now })
      .eq("id", data.sessionId);
    return { ok: true };
  });

export const getWhatsAppTranscript = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string; accessToken: string }) =>
    z.object({ sessionId: UuidSchema, accessToken: UuidSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const session = await verifySession(data.sessionId, data.accessToken);
    if (!session) throw new Error("Invalid session");
    const supabase = await admin();
    const { data: rows } = await supabase
      .from("messages")
      .select("sender, content, created_at")
      .eq("chat_id", data.sessionId)
      .order("created_at", { ascending: true });
    return rows ?? [];
  });

const MEETING_TRIGGER = "[BOOK_MEETING]";
const QUOTATION_TRIGGER = "[REQUEST_QUOTATION]";
const HANDOFF_TRIGGER = "[HUMAN_HANDOFF]";

const DEFAULT_SYSTEM_PROMPT = `[ROLE & MANDATE]

You are the AI assistant for Nexen Strategy, a digital agency delivering Brand & Design, Web & App Development, Software Solutions, AI & Automation, Marketing & Growth, and Media Production.

[STRICT OPERATIONAL GUARDRAILS]

1. KNOWLEDGE RESTRICTION: Rely EXCLUSIVELY on the data provided within the [KNOWLEDGE BASE] block below, plus the six service lines named above. If a question cannot be answered from that, say: "I don't have that detail right now, but I can connect you with our team."

2. NO HALLUCINATION: Never invent pricing, timelines, client names, links or guarantees.

3. LANGUAGE ADAPTABILITY (PAKISTANI ROMAN URDU / ENGLISH ONLY):
   - Reply in professional English OR natural Pakistani Roman Urdu, matching the user.
   - Use Pakistani phrasing such as "Aap ka", "Theek hai", "Ji", "Shukriya", "Assalam-o-Alaikum".
   - NEVER use Hindi or Indian-transliterated vocabulary: "Dhanyawad", "Kripya", "Samay", "Namaste", "Swagat", "prashn", "sandesh", "sahayata".

4. ASSISTANT IDENTITY & GENDER (STRICT):
   - You are the "Nexen Strategy Assistant". Your gender is MALE. In Roman Urdu always use masculine first-person endings: "sakta", "karon ga", "raha hoon".

5. BEHAVIOR: Be concise, consultative and professional — an agency strategist, not a salesperson. Do not mention that you are reading from a document.`;

async function fetchBotConfig(): Promise<{ prompt: string; temperature: number }> {
  try {
    const supabase = await admin();
    const { data } = await supabase
      .from("bot_config")
      .select("system_prompt, temperature")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prompt = data?.system_prompt?.trim();
    const t = typeof data?.temperature === "number" ? data.temperature : 0.3;
    const temperature = Math.min(1, Math.max(0, t));
    return {
      prompt: prompt && prompt.length > 0 ? prompt : DEFAULT_SYSTEM_PROMPT,
      temperature,
    };
  } catch (err) {
    console.error("[chat] failed to load bot_config, using default", err);
    return { prompt: DEFAULT_SYSTEM_PROMPT, temperature: 0.3 };
  }
}

function buildSystemPrompt(base: string, clinicInfo: string) {
  return `${base}

[FORMATTING RULES]
- Do NOT use Markdown syntax in replies. Never use asterisks (*, **) for bold, italics, or bullets.
- For lists, use plain numbered items ("1.", "2.", "3.") or a simple hyphen ("- ") at the start of a new line.
- Keep replies clean plain text suitable for a chat bubble.

[SPECIAL ACTIONS]
When the user's intent clearly matches one of these, end your reply with the trigger on its own new line (never mention or explain these triggers to the user, and never output both):
- If the user wants to book / schedule a meeting, call, consultation or demo, respond with "Happy to set that up — you can pick a date and time on our booking page." and then append: ${MEETING_TRIGGER}
- If the user wants pricing, a quote, a proposal or an estimate for a project, respond with "I can get you a tailored quotation — just share your services and budget on our quotation form." and then append: ${QUOTATION_TRIGGER}
- If the user wants to talk to a human / staff / agent / real person, append: ${HANDOFF_TRIGGER}

[START KNOWLEDGE BASE]

${clinicInfo}

[END KNOWLEDGE BASE]`;
}

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { sessionId: string; accessToken: string; content: string; language: "en" | "roman"; resumed?: boolean }) =>
      z
        .object({
          sessionId: UuidSchema,
          accessToken: UuidSchema,
          content: ContentSchema,
          language: LangSchema,
          resumed: z.boolean().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await verifySession(data.sessionId, data.accessToken);
    if (!session) throw new Error("Invalid session");
    const supabase = await admin();

    if (data.resumed) await insertResumeMarker(data.sessionId);
    // 1. Persist the user message.
    const { data: userRow, error: userErr } = await supabase
      .from("messages")
      .insert({ chat_id: data.sessionId, sender: "user", content: data.content })
      .select("id, sender, content, created_at")
      .single();
    if (userErr || !userRow) throw new Error("Failed to save user message");
    await supabase
      .from("chats")
      .update({ last_message_at: userRow.created_at })
      .eq("id", data.sessionId);

    // If the admin has paused the AI on this session, save the user message
    // and stop — the admin will reply manually via the live-chat panel.
    if ((session as { is_ai_enabled?: boolean }).is_ai_enabled === false) {
      await supabase
        .from("chats")
        .update({ updated_at: new Date().toISOString(), last_message_at: userRow.created_at })
        .eq("id", data.sessionId);
      return {
        userMessage: userRow,
        botMessage: null,
        triggerMeeting: false,
        triggerQuotation: false,
        triggerHandoff: false,
      };
    }

    // 2. Load conversation history + clinic knowledge in parallel.
    const [{ data: history }, { data: info }] = await Promise.all([
      supabase
        .from("messages")
        .select("sender, content")
        .eq("chat_id", data.sessionId)
        .order("created_at", { ascending: true })
        .limit(50),
      supabase
        .from("bot_knowledge")
        .select("raw_text")
        .order("updated_at", { ascending: false }),
    ]);

    const clinicInfo = (info ?? [])
      .map((r) => r.raw_text)
      .filter((t): t is string => Boolean(t?.trim()))
      .join("\n\n---\n\n");
    const { prompt: base, temperature } = await fetchBotConfig();
    const system = buildSystemPrompt(base, clinicInfo);

    const messages = (history ?? [])
      .filter((m) => m.content?.trim() && (m.sender === "user" || m.sender === "bot"))
      .map((m) => ({
        role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));

    // 3. Call the LLM via Lovable AI Gateway.
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    let raw = "";
    try {
      const result = await generateText({ model, system, messages, temperature });
      raw = result.text?.trim() ?? "";
    } catch (err) {
      console.error("[sendChatMessage] LLM error", err);
      throw new Error("AI service is temporarily unavailable. Please try again in a moment.");
    }
    if (!raw) raw = data.language === "roman"
      ? "Maazrat, main abhi jawab nahi de saka. Dobara koshish karein."
      : "Sorry, I couldn't generate a reply. Please try again.";

    // 4. Detect triggers and strip them from the visible reply.
    let triggerMeeting = raw.includes(MEETING_TRIGGER);
    let triggerQuotation = raw.includes(QUOTATION_TRIGGER);
    let triggerHandoff = raw.includes(HANDOFF_TRIGGER);

    // Fallback intent detection — the LLM sometimes forgets to append the
    // trigger token even when its reply clearly hands off / books. Detect
    // the intent from the user's own message so the frontend still switches
    // to the right form.
    const userText = data.content.toLowerCase();
    const handoffPatterns = [
      /\bhuman\b/, /\bagent\b/, /\bstaff\b/, /\breal person\b/,
      /\btalk to (a )?(human|agent|person|someone|staff|representative)\b/,
      /\bconnect (me )?(to|with) (a )?(human|agent|person|staff)\b/,
      /\blive chat\b/, /\bcustomer (support|service)\b/,
      // Roman Urdu
      /\binsan\b/, /\bnumainda\b/, /\bstaff se baat\b/, /\bkisi se baat\b/,
      /\breal admi\b/, /\bhuman se baat\b/, /\bagent se baat\b/,
    ];
    const meetingPatterns = [
      /\bmeeting\b/, /\bbook(ing)?\b/, /\bschedul(e|ing)\b/, /\bcall\b/, /\bconsultation\b/,
      /\bdemo\b/, /\bslot\b/,
      // Roman Urdu
      /\bmulaqat\b/, /\bwaqt\b/, /\btime lena\b/,
    ];
    const quotationPatterns = [
      /\bquot(e|ation)\b/, /\bproposal\b/, /\bestimate\b/, /\bpricing\b/, /\bprice\b/,
      /\bcost\b/, /\bbudget\b/,
      // Roman Urdu
      /\bqeemat\b/, /\brate\b/, /\bkitna kharcha\b/,
    ];
    if (!triggerHandoff && handoffPatterns.some((re) => re.test(userText))) {
      triggerHandoff = true;
    }
    if (!triggerMeeting && meetingPatterns.some((re) => re.test(userText))) {
      triggerMeeting = true;
    }
    if (!triggerQuotation && quotationPatterns.some((re) => re.test(userText))) {
      triggerQuotation = true;
    }
    // Handoff wins over the self-serve forms; a meeting wins over a quotation.
    if (triggerHandoff) { triggerMeeting = false; triggerQuotation = false; }
    else if (triggerMeeting) triggerQuotation = false;

    let visible = raw
      .replace(new RegExp(MEETING_TRIGGER.replace(/[[\]]/g, "\\$&"), "g"), "")
      .replace(new RegExp(QUOTATION_TRIGGER.replace(/[[\]]/g, "\\$&"), "g"), "")
      .replace(new RegExp(HANDOFF_TRIGGER.replace(/[[\]]/g, "\\$&"), "g"), "")
      .trim();

    // Sanitize Markdown-style formatting the LLM sometimes emits.
    visible = visible
      .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
      .replace(/(^|\s)\*\s+/g, "$1• ") // "* " bullet → "• "
      .replace(/\*(.+?)\*/g, "$1"); // *italic*

    if (!visible) {
      visible = triggerMeeting
        ? "Happy to set that up — you can pick a date and time on our booking page."
        : triggerQuotation
          ? "I can get you a tailored quotation — just share your services and budget on our quotation form."
          : data.language === "roman"
            ? "Aap ko hamari team se milaya ja raha hai."
            : "Connecting you with our team.";
    }

    // 5. Persist the bot reply.
    const { data: botRow, error: botErr } = await supabase
      .from("messages")
      .insert({ chat_id: data.sessionId, sender: "bot", content: visible })
      .select("id, sender, content, created_at")
      .single();
    if (botErr || !botRow) throw new Error("Failed to save bot reply");

    await supabase
      .from("chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.sessionId);

    return {
      userMessage: userRow,
      botMessage: botRow,
      triggerMeeting,
      triggerQuotation,
      triggerHandoff,
    };
  });
