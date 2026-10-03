import { useEffect, useRef, useState } from "react";
import { Send, User, Bot, Headphones, Eraser, MessageCircle, X, ChevronLeft, FileText, CalendarDays } from "lucide-react";
import nexenXMark from "@/assets/nexen-x-mark.png";
import { STRINGS, type Language } from "@/lib/chat-strings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createChatSession,
  getChatSession,
  getWhatsAppTranscript,
  listChatMessages,
  persistBotMessage,
  requestHumanHandoff,
  sendChatMessage,
  sendUserMessage,
} from "@/lib/chat.functions";
import { sendHandoffAlertEmail } from "@/lib/email.functions";
import { toast } from "sonner";
import { QuotationForm } from "@/components/forms/QuotationForm";
import { BookMeetingForm } from "@/components/forms/BookMeetingForm";
import { formatPakistanDateTime } from "@/lib/date-time";

type ChatState = "CHAT" | "LIVE_CHAT" | "ENDED";
type WidgetView = "chat" | "quote" | "meeting";

type Message = {
  id: string;
  role: "bot" | "user" | "agent" | "system";
  content: string;
  createdAt: string;
};

const SESSION_KEY = "nexen_session_id";
const SESSION_TOKEN_KEY = "nexen_session_token";
const CLEARED_AT_KEY = "nexen_chat_cleared_at";
const RESUME_KEY = "nexen_chat_resume_pending";
const RESUME_MARKER = "Visitor returned after clearing chat";
const HANDOFF_TEXT_RE = /talk\s+to\s+(a\s+)?human/i;

// Fixed UI language for shell strings (placeholders, form labels, error copy).
// The LLM auto-detects and replies in the user's language via the system prompt,
// so no manual language selection is required from the user.
const UI_LANG: Language = "en";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [widgetView, setWidgetView] = useState<WidgetView>("chat");
  const [state, setState] = useState<ChatState>("CHAT");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const sessionTokenRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => { sessionTokenRef.current = sessionToken; }, [sessionToken]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Init
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedSession = window.localStorage.getItem(SESSION_KEY);
    const savedToken = window.localStorage.getItem(SESSION_TOKEN_KEY);

    if (savedSession && savedToken) {
      void resumeSession(savedSession, savedToken);
    } else {
      setMessages([{ id: uid(), role: "bot", content: STRINGS[UI_LANG].welcome, createdAt: new Date().toISOString() }]);
      setState("CHAT");
      void ensureSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearStoredSession() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    window.localStorage.removeItem(CLEARED_AT_KEY);
  }

  function getClearedAt(): number {
    if (typeof window === "undefined") return 0;
    const v = Number(window.localStorage.getItem(CLEARED_AT_KEY));
    return Number.isFinite(v) ? v : 0;
  }

  async function resumeSession(sid: string, token: string) {
    const session = await getChatSession({ data: { sessionId: sid, accessToken: token } }).catch(() => null);
    if (!session) {
      clearStoredSession();
      setMessages([{ id: uid(), role: "bot", content: STRINGS[UI_LANG].welcome, createdAt: new Date().toISOString() }]);
      setState("CHAT");
      void ensureSession();
      return;
    }
    setSessionId(sid);
    setSessionToken(token);
    const msgs = await listChatMessages({ data: { sessionId: sid, accessToken: token } }).catch(() => []);
    const clearedAt = getClearedAt();
    msgs.forEach((m) => seenIdsRef.current.add(m.id));
    const history: Message[] = msgs.filter((m) => new Date(m.created_at).getTime() > clearedAt).map((m) => {
      return { id: m.id, role: m.sender as Message["role"], content: m.content, createdAt: m.created_at };
    });
    if (session.status === "human") {
      setMessages(history.length ? history : [
        { id: uid(), role: "system", content: STRINGS[UI_LANG].liveConnecting, createdAt: new Date().toISOString() },
      ]);
      setState("LIVE_CHAT");
    } else {
      setMessages([
        ...history,
      ]);
      if (!history.length) setMessages([{ id: uid(), role: "bot", content: STRINGS[UI_LANG].welcome, createdAt: new Date().toISOString() }]);
      setState("CHAT");
    }
  }

  // Near-realtime sync for messages (admin manual replies, takeover notices, etc.).
  // Anon role cannot subscribe to chat_messages via Supabase Realtime under current RLS,
  // so we poll the server function on a short interval whenever a session is active.
  // This ensures the patient sees admin messages instantly even before entering LIVE_CHAT.
  useEffect(() => {
    if (!sessionId || !sessionToken) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        // Detect an admin-ended session so the widget switches to the
        // "Chat ended" banner instead of silently continuing.
        const session = await getChatSession({ data: { sessionId, accessToken: sessionToken } }).catch(() => null);
        if (!cancelled && session?.status === "closed") {
          showEndedState();
          return;
        }
        // Admin re-engaged the AI: leave live-chat mode so replies come from the bot again.
        if (!cancelled && session?.status === "bot") {
          setState((s) => (s === "LIVE_CHAT" ? "CHAT" : s));
        }
        const rows = await listChatMessages({ data: { sessionId, accessToken: sessionToken } });
        // Ignore the patient's own messages — they're added optimistically in handleSend.
        // Admin/agent/bot/system messages still flow through so takeover works instantly.
        const fresh = rows.filter(
          (r) => r.sender !== "user" && r.content !== RESUME_MARKER && !seenIdsRef.current.has(r.id),
        );
        if (fresh.length) {
          fresh.forEach((r) => seenIdsRef.current.add(r.id));
          setMessages((m) => {
            // Extra safety: dedupe by id AND by exact (role+content) match against existing state.
            const existingIds = new Set(m.map((x) => x.id));
            const existingKeys = new Set(m.map((x) => `${x.role}::${x.content}`));
            const toAppend = fresh
              .filter(
                (r) =>
                  !existingIds.has(r.id) &&
                  !existingKeys.has(`${r.sender}::${r.content}`),
              )
              .map((r) => ({ id: r.id, role: r.sender as Message["role"], content: r.content, createdAt: r.created_at }));
            return toAppend.length ? [...m, ...toAppend] : m;
          });
          // Auto-scroll to newest so patient notices admin/AI replies immediately.
          requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: "smooth",
            });
          });
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(tick, 1500);
    void tick();
    return () => { cancelled = true; clearInterval(interval); };
  }, [sessionId, sessionToken]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [state]);

  const t = STRINGS[UI_LANG];

  function closeWidget() {
    setIsOpen(false);
  }

  function pushLocal(msg: Omit<Message, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
    setMessages((m) => [...m, { id: msg.id ?? uid(), createdAt: msg.createdAt ?? new Date().toISOString(), ...msg }]);
  }

  // Push locally AND persist to chat_messages so /admin can see the full history.
  function saveMessage(role: "bot" | "user" | "system", content: string) {
    pushLocal({ role, content });
    const sid = sessionIdRef.current;
    const tok = sessionTokenRef.current;
    if (!sid || !tok || !content?.trim()) return;
    void (async () => {
      try {
        if (role === "user") {
          const row = await sendUserMessage({
            data: { sessionId: sid, accessToken: tok, content },
          });
          seenIdsRef.current.add(row.id);
        } else {
          const row = await persistBotMessage({
            data: { sessionId: sid, accessToken: tok, content, sender: role },
          });
          seenIdsRef.current.add(row.id);
        }
      } catch {
        /* non-fatal: local state still shows the message */
      }
    })();
  }

  async function ensureSession(): Promise<{ id: string; token: string } | null> {
    if (sessionId && sessionToken) return { id: sessionId, token: sessionToken };
    try {
      const res = await createChatSession({ data: { language: UI_LANG } });
      setSessionId(res.sessionId);
      setSessionToken(res.accessToken);
      sessionIdRef.current = res.sessionId;
      sessionTokenRef.current = res.accessToken;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SESSION_KEY, res.sessionId);
        window.localStorage.setItem(SESSION_TOKEN_KEY, res.accessToken);
      }
      return { id: res.sessionId, token: res.accessToken };
    } catch {
      return null;
    }
  }

  async function startLiveChat(reason: "button" | "fallback") {
    if (reason === "button") {
      saveMessage("user", "Talk to a human");
    }
    const sess = await ensureSession();
    if (!sess) {
      saveMessage("bot", t.error);
      return;
    }
    const sysContent = t.liveConnecting;
    try {
      await requestHumanHandoff({
        data: { sessionId: sess.id, accessToken: sess.token, systemMessage: sysContent },
      });
    } catch {
      saveMessage("bot", t.error);
      return;
    }
    pushLocal({ role: "system", content: sysContent });
    setState("LIVE_CHAT");
    // Fire-and-forget admin alert — never blocks the chat flow.
    void sendHandoffAlertEmail({
      data: {
        sessionId: sess.id,
        appUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    }).catch(() => { /* non-fatal */ });
  }

  // Show ONLY the "Chat ended" banner — no greeting, no new session. A fresh
  // session + welcome message is created only when the user explicitly starts
  // a new chat via startNewChat().
  function showEndedState() {
    clearStoredSession();
    setSessionId(null);
    setSessionToken(null);
    sessionIdRef.current = null;
    sessionTokenRef.current = null;
    seenIdsRef.current = new Set();
    setInput("");
    setMessages([
      { id: uid(), role: "system", content: STRINGS[UI_LANG].chatEnded, createdAt: new Date().toISOString() },
    ]);
    setState("ENDED");
  }

  // Visitor-side "Clear chat": wipes the visible history only. The session
  // stays open and persisted so returning visitors keep the same NS ID.
  function clearChat() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CLEARED_AT_KEY, String(Date.now()));
      window.localStorage.setItem(RESUME_KEY, "1");
    }
    setInput("");
    setMessages([{ id: uid(), role: "bot", content: STRINGS[UI_LANG].welcome, createdAt: new Date().toISOString() }]);
    setWidgetView("chat");
  }

  // Explicit fresh start — this is the only place (besides first mount) where
  // the welcome greeting and a brand-new session are created.
  function startNewChat() {
    seenIdsRef.current = new Set();
    setInput("");
    setMessages([{ id: uid(), role: "bot", content: STRINGS[UI_LANG].welcome, createdAt: new Date().toISOString() }]);
    setState("CHAT");
    setWidgetView("chat");
    void ensureSession();
  }

  async function openWhatsApp() {
    const phone = "923411747058";
    const header = "Nexen Strategy - Chat History:\n----------------------------------\n";
    const roleLabel = (r: Message["role"]) =>
      r === "user" ? "You" : r === "agent" ? "Staff" : r === "system" ? "System" : "Bot";
    let lines: string[] = [];
    if (sessionId && sessionToken) {
      try {
        const data = await getWhatsAppTranscript({ data: { sessionId, accessToken: sessionToken } });
        if (data.length) {
          lines = data.map((m) => `[${roleLabel(m.sender as Message["role"])}]: ${m.content}`);
        }
      } catch { /* fall through */ }
    }
    if (!lines.length) {
      lines = messages
        .filter((m) => m.content?.trim())
        .map((m) => `[${roleLabel(m.role)}]: ${m.content}`);
    }
    const transcript = header + lines.join("\n");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(transcript)}`;
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleSend() {
    if (state === "ENDED" || isProcessingRef.current) return;
    const text = input.trim();
    if (!text) return;
    isProcessingRef.current = true;
    setIsProcessing(true);
    setInput("");
    try {
      await doSend(text);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function takeResumeFlag() {
    if (typeof window === "undefined") return false;
    const v = window.localStorage.getItem(RESUME_KEY) === "1";
    if (v) window.localStorage.removeItem(RESUME_KEY);
    return v;
  }

  async function doSend(text: string) {
    if (state !== "LIVE_CHAT" && HANDOFF_TEXT_RE.test(text)) {
      const sess = (sessionId && sessionToken) ? { id: sessionId, token: sessionToken } : await ensureSession();
      if (sess) {
        const resumed = takeResumeFlag();
        const localId = uid();
        pushLocal({ id: localId, role: "user", content: text });
        try {
          const row = await sendUserMessage({ data: { sessionId: sess.id, accessToken: sess.token, content: text, resumed } });
          seenIdsRef.current.add(row.id);
          setMessages((m) => m.map((x) => (x.id === localId ? { ...x, id: row.id } : x)));
        } catch { /* handoff still proceeds */ }
      }
      await startLiveChat("fallback");
      return;
    }

    if (state === "LIVE_CHAT") {
      const sess = (sessionId && sessionToken)
        ? { id: sessionId, token: sessionToken }
        : await ensureSession();
      if (!sess) {
        pushLocal({ role: "bot", content: t.error });
        return;
      }
      const localId = uid();
      pushLocal({ id: localId, role: "user", content: text });
      try {
        const row = await sendUserMessage({
          data: { sessionId: sess.id, accessToken: sess.token, content: text, resumed: takeResumeFlag() },
        });
        seenIdsRef.current.add(row.id);
        // Reconcile optimistic id with server id so the poller's dedupe works.
        setMessages((m) => m.map((x) => (x.id === localId ? { ...x, id: row.id } : x)));
      } catch {
        pushLocal({ role: "bot", content: t.error });
      }
      return;
    }

    // Pure LLM path: server function persists user + bot messages and returns trigger flags.
    const sess = (sessionId && sessionToken)
      ? { id: sessionId, token: sessionToken }
      : await ensureSession();
    if (!sess) {
      pushLocal({ role: "bot", content: t.error });
      return;
    }
    const localUserId = uid();
    pushLocal({ id: localUserId, role: "user", content: text });
    setLoading(true);
    try {
      const res = await sendChatMessage({
        data: { sessionId: sess.id, accessToken: sess.token, content: text, language: UI_LANG, resumed: takeResumeFlag() },
      });
      seenIdsRef.current.add(res.userMessage.id);
      // Reconcile optimistic id with the server-persisted id to prevent the
      // background poller from appending a duplicate of this same message.
      setMessages((m) => m.map((x) => (x.id === localUserId ? { ...x, id: res.userMessage.id } : x)));
      if (res.botMessage) {
        const bot = res.botMessage;
        seenIdsRef.current.add(bot.id);
        // The poller may already have appended this reply — never add it twice.
        setMessages((m) => (m.some((x) => x.id === bot.id) ? m : [...m, { id: bot.id, role: "bot", content: bot.content, createdAt: bot.created_at }]));
      }
      if (res.triggerHandoff) {
        void startLiveChat("fallback");
      }
    } catch (err) {
      console.error("[sendChatMessage] failed", err);
      pushLocal({ role: "bot", content: t.error });
    } finally {
      setLoading(false);
    }
  }


  if (!isOpen) {
    return (
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open Nexen Strategy chat"
        className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full bg-primary p-0 text-primary-foreground shadow-xl hover:bg-primary/90 sm:bottom-6 sm:right-6 sm:h-16 sm:w-16"
      >
        <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7" />
        <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-secondary" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex min-w-0 flex-col overflow-hidden bg-background shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(720px,calc(100dvh-3rem))] sm:w-[min(420px,calc(100vw-3rem))] sm:rounded-lg sm:border sm:border-border">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-primary px-3 py-3 text-primary-foreground">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {widgetView !== "chat" ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => setWidgetView("chat")} aria-label="Back to chat" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          ) : (
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border"
            style={{
              backgroundImage: `url(${nexenXMark})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: "76%",
              backgroundPosition: "center",
            }}
            role="img"
            aria-label="Nexen Strategy"
          />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold sm:text-base">
              {widgetView === "quote" ? "Request a Quotation" : widgetView === "meeting" ? "Book a Meeting" : t.clinicName}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-primary-foreground/75">
              {widgetView === "chat" && <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", state === "LIVE_CHAT" ? "bg-secondary" : "bg-accent")} />}
              <span className="truncate">{widgetView === "chat" ? (state === "LIVE_CHAT" ? t.liveActive : t.tagline) : "Nexen Strategy"}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {widgetView === "chat" && state !== "ENDED" && <Button
            variant="outline"
            size="icon"
            onClick={clearChat}
            className="border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-[#f10907] hover:text-white"
            title="Clear chat"
            aria-label="Clear chat"
          >
            <Eraser className="h-4 w-4" />
          </Button>}
          <Button type="button" variant="ghost" size="icon" onClick={closeWidget} aria-label="Close chat" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {widgetView === "quote" ? (
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-card">
          <QuotationForm compact />
        </div>
      ) : widgetView === "meeting" ? (
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-card">
          <BookMeetingForm compact />
        </div>
      ) : <>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted/40 px-3 py-4">
        <div className="flex w-full min-w-0 flex-col gap-3">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
            />
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                <Bot className="h-4 w-4 text-secondary-foreground" />
              </div>
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card p-3">
        {state === "ENDED" ? (
          <Button type="button" onClick={startNewChat} className="w-full gap-1.5 bg-primary hover:bg-primary/90">
            <MessageCircle className="h-3.5 w-3.5" />
            <span>{t.startNewChat}</span>
          </Button>
        ) : (
        <div className="flex w-full min-w-0 flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setWidgetView("quote")} className="min-w-0 gap-1.5 px-2">
              <FileText className="h-3.5 w-3.5" /><span className="truncate">Get a Quote</span>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setWidgetView("meeting")} className="min-w-0 gap-1.5 px-2">
              <CalendarDays className="h-3.5 w-3.5" /><span className="truncate">Book Meeting</span>
            </Button>
          </div>
          {state === "CHAT" && (
            <Button type="button" variant="outline" size="sm" onClick={() => startLiveChat("button")} className="w-full gap-1.5">
              <Headphones className="h-3.5 w-3.5" />
              <span>Talk to Human</span>
            </Button>
          )}
          <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={t.inputPlaceholder}
                disabled={isProcessing}
                className="flex-1"
                maxLength={1000}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className="bg-primary hover:bg-primary/90"
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
          </div>
        </div>
        )}
      </div>
      </>}
    </div>
  );
}

function MessageBubble({
  message,
}: {
  message: Message;
}) {
  if (message.role === "system") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center rounded-lg bg-secondary/30 px-4 py-2 text-center text-xs text-secondary-foreground ring-1 ring-secondary/50">
        <div className="flex items-center gap-2">
        <Headphones className="h-3.5 w-3.5" />
        <span>{message.content}</span>
        </div>
        <span className="mt-1 text-[10px] text-muted-foreground">{formatPakistanDateTime(message.createdAt)}</span>
      </div>
    );
  }

  const isBot = message.role === "bot" || message.role === "agent";
  const isAgent = message.role === "agent";

  return (
    <div className={cn("flex gap-2", isBot ? "justify-start" : "justify-end")}>
      {isBot && (
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isAgent ? "bg-secondary" : "bg-muted",
        )}>
          {isAgent ? (
            <Headphones className="h-4 w-4 text-secondary-foreground" />
          ) : (
            <Bot className="h-4 w-4 text-primary" />
          )}
        </div>
      )}
      <div className={cn("flex max-w-[85%] flex-col gap-2", !isBot && "items-end")}>
        {isAgent && (
          <span className="px-1 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
            Nexen Strategy Team
          </span>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words",
            isBot
              ? isAgent
                ? "rounded-tl-sm bg-secondary/25 text-foreground ring-1 ring-secondary/50"
                : "rounded-tl-sm bg-card text-card-foreground ring-1 ring-border"
              : "rounded-tr-sm bg-primary text-primary-foreground",
          )}
        >
          {message.content}
        </div>
        <span className="px-1 text-[10px] text-muted-foreground">{formatPakistanDateTime(message.createdAt)}</span>
      </div>
      {!isBot && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
