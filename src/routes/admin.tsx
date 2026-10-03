import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Bell, BellOff, BookOpen, Headphones, LogOut, Send, User, Bot,
  MessageSquare, CalendarDays, Settings as SettingsIcon, UploadCloud, Link2,
  Trash2, Globe, FileText, Loader2, CheckCircle2, Plus, CalendarIcon,
  ChevronDown, ChevronLeft, ChevronRight, FileSpreadsheet, Mail, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { useServerFn } from "@tanstack/react-start";
import {
  listBotKnowledge, ingestUrlKnowledge, ingestFileKnowledge, deleteBotKnowledge,
} from "@/lib/knowledge.functions";
import { getBotConfig, updateBotConfig } from "@/lib/bot-config.functions";
import { toast } from "sonner";
import nexenLogoAsset from "@/assets/nexen-logo-dark.png.asset.json";
import { formatSessionId } from "@/lib/nexen";
import { QuotationsPanel } from "@/components/admin/QuotationsPanel";
import { MeetingsPanel } from "@/components/admin/MeetingsPanel";
import { GmailPanel } from "@/components/admin/GmailPanel";
import { AutomationsPanel } from "@/components/admin/AutomationsPanel";
import { GmailSettingsCard } from "@/components/admin/GmailSettingsCard";
import { TeamAccessCard } from "@/components/admin/TeamAccessCard";
import { AdminStatusToggle, WhatsAppSettingsCard, WhatsAppBadge } from "@/components/admin/WhatsAppHandoff";
import { formatPakistanDateTime, formatPakistanTime } from "@/lib/date-time";

type TabKey = "chats" | "quotations" | "meetings" | "gmail" | "automations" | "knowledge" | "settings";
import { Slider } from "@/components/ui/slider";

const adminSearchSchema = z.object({
  session: fallback(z.string(), "").default(""),
  tab: fallback(
    z.enum(["chats", "quotations", "meetings", "gmail", "automations", "knowledge", "settings"]),
    "chats",
  ).default("chats"),
});

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Nexen Strategy — Admin Dashboard" },
      { name: "description", content: "Manage Nexen Strategy live chats, quotations, meetings, knowledge, and chatbot settings." },
      { property: "og:title", content: "Nexen Strategy — Admin Dashboard" },
      { property: "og:description", content: "Manage Nexen Strategy live chats, quotations, meetings, knowledge, and chatbot settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: zodValidator(adminSearchSchema),
  component: AdminPage,
});


type Session = {
  id: string;
  status: string;
  user_language: string | null;
  updated_at: string;
  created_at: string;
  handoff_username: string | null;
  handoff_topic: string | null;
  handoff_queries: string | null;
  handoff_submitted_at: string | null;
  is_ai_enabled?: boolean;
  session_number?: number | null;
  last_message_at?: string | null;
  whatsapp_routed?: boolean;
};

function activityTime(s: Session) {
  return new Date(s.last_message_at ?? s.created_at).getTime();
}
function sortByActivity(rows: Session[]) {
  return rows.slice().sort((a, b) => activityTime(b) - activityTime(a));
}

type Msg = {
  id: string;
  chat_id: string;
  sender: string;
  content: string;
  created_at: string;
};

const ORIGINAL_TITLE = "Nexen Strategy — Admin";
type AlertKind = "new" | "handoff";

function AdminPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  // Per-session alert tag: "new" = fresh AI session, "handoff" = urgent human request.
  const [alertKinds, setAlertKinds] = useState<Record<string, AlertKind>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem("admin_sound_enabled");
    return v === null ? true : v === "true";
  });
  const activeIdRef = useRef<string | null>(null);
  const sessionsRef = useRef<Session[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const titleFlashRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Sessions already announced as "new chat" — each session alerts only once.
  const notifiedNewRef = useRef<Set<string>>(new Set());
  const notifiedHandoffRef = useRef<Set<string>>(new Set());
  const chimeRef = useRef<HTMLAudioElement | null>(null);
  const selectSessionRef = useRef<((id: string) => void) | null>(null);

  // Preload the chime so it can play even while the tab is in the background.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio("/notification.wav");
    audio.preload = "auto";
    audio.volume = 0.7;
    chimeRef.current = audio;
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem("admin_sidebar_collapsed") === "true");
    } catch {
      // Keep the expanded default when storage is unavailable.
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try { window.localStorage.setItem("admin_sidebar_collapsed", String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Must run synchronously inside a user gesture (click/keydown).
  const enableSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume();

      // Test chime so staff can confirm it works.
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);

      setSoundOn(true);
      try { window.localStorage.setItem("admin_sound_enabled", "true"); } catch { /* ignore */ }
      // Also request browser notification permission on the same user gesture.
      try {
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          void Notification.requestPermission();
        }
      } catch { /* ignore */ }
    } catch {
      // ignore
    }
  }, []);

  const disableSound = useCallback(() => {
    setSoundOn(false);
    try { window.localStorage.setItem("admin_sound_enabled", "false"); } catch { /* ignore */ }
  }, []);

  const toggleSound = useCallback(() => {
    if (soundOn) disableSound();
    else enableSound();
  }, [soundOn, disableSound, enableSound]);

  // Initialize AudioContext on the first user gesture when sound is on.
  useEffect(() => {
    if (!soundOn) return;
    if (audioCtxRef.current) return;
    const handler = () => {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new Ctx();
        if (audioCtxRef.current.state === "suspended") void audioCtxRef.current.resume();
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          void Notification.requestPermission();
        }
      } catch { /* ignore */ }
    };
    window.addEventListener("click", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [soundOn]);


  const labelFor = (id: string) => {
    const s = sessionsRef.current.find((x) => x.id === id);
    return formatSessionId(s?.session_number, id);
  };

  const playChime = useCallback(() => {
    if (!soundOn) return;
    // HTMLAudioElement keeps playing in background tabs (unlike throttled Web Audio).
    try {
      const audio = chimeRef.current ?? new Audio("/notification.wav");
      chimeRef.current = audio;
      audio.currentTime = 0;
      audio.volume = 0.7;
      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.catch(() => playBeep());
      }
      return;
    } catch {
      // fall through to beep
    }
    playBeep();
  }, [soundOn]);

  const playBeep = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    try {
      const now = ctx.currentTime;
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.15;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch {
      // ignore
    }
  }, []);

  // Native desktop notification — fires even when the dashboard tab is hidden.
  const sendDesktopNotification = useCallback((kind: AlertKind, sessionId: string) => {
    try {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      const short = labelFor(sessionId);
      const title = kind === "handoff"
        ? `[HANDOFF ALERT] ${short}`
        : `[NEW CHAT] ${short}`;
      const n = new Notification(title, {
        body: `A client needs assistance in ${short}. Click to view.`,
        tag: `${kind}:${sessionId}`,
        requireInteraction: kind === "handoff",
      } as NotificationOptions);
      n.onclick = () => {
        try { window.focus(); } catch { /* ignore */ }
        selectSessionRef.current?.(sessionId);
        n.close();
      };
    } catch { /* ignore */ }
  }, []);

  const flagAttention = useCallback((
    sessionId: string,
    session?: Partial<Session>,
    options?: { kind?: AlertKind; message?: boolean },
  ) => {
    if (activeIdRef.current === sessionId) return;
    if (options?.message) {
      setUnreadCounts((prev) => ({ ...prev, [sessionId]: (prev[sessionId] ?? 0) + 1 }));
      return;
    }
    const kind = options?.kind;
    if (!kind) return;
    // Handoff outranks a plain new-session tag.
    setAlertKinds((prev) => (prev[sessionId] === "handoff" ? prev : { ...prev, [sessionId]: kind }));

    playChime();
    sendDesktopNotification(kind, sessionId);
    try {
      const short = labelFor(sessionId);
      const name = session?.handoff_username?.trim();
      const description = `${short}${name ? ` · ${name}` : ""}`;
      if (kind === "handoff") toast.error("Human handoff requested!", { description });
      else toast.info("New chat session started", { description });
    } catch { /* ignore */ }
  }, [playChime, sendDesktopNotification]);

  const totalUnread = useMemo(() => {
    const ids = new Set([...Object.keys(unreadCounts), ...Object.keys(alertKinds)]);
    let total = 0;
    ids.forEach((id) => {
      total += unreadCounts[id] ?? (alertKinds[id] ? 1 : 0);
    });
    return total;
  }, [alertKinds, unreadCounts]);

  // Flash the browser tab title while the dashboard is in the background.
  useEffect(() => {
    const stopFlash = () => {
      if (titleFlashRef.current) {
        clearInterval(titleFlashRef.current);
        titleFlashRef.current = null;
      }
      document.title = ORIGINAL_TITLE;
    };
    const sync = () => {
      if (totalUnread === 0 || document.visibilityState === "visible") {
        stopFlash();
        return;
      }
      if (titleFlashRef.current) return;
      const alertTitle = `🔴 (${totalUnread}) New Alert! - Nexen Admin`;
      let toggle = false;
      document.title = alertTitle;
      titleFlashRef.current = setInterval(() => {
        toggle = !toggle;
        document.title = toggle ? ORIGINAL_TITLE : alertTitle;
      }, 1200);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      stopFlash();
    };
  }, [totalUnread]);

  useEffect(() => {
    return () => {
      document.title = ORIGINAL_TITLE;
    };
  }, []);

  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const deepLinkHandledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error || !data.user) {
          navigate({ to: "/admin/login" });
          return;
        }
        setAuthed(true);
      } catch (e) {
        console.error("[admin] auth check failed", e);
        if (!cancelled) navigate({ to: "/admin/login" });
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/admin/login" });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const loadSessions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .neq("status", "closed")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) console.error("[admin] loadSessions error", error);
      const rows = sortByActivity((data ?? []) as Session[]);
      setSessions(rows);
    } catch (e) {
      console.error("[admin] loadSessions threw", e);
      setSessions([]);
    } finally {
      setSessionsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void loadSessions();
    const channel = supabase
      .channel("admin:sessions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chats" },
        (payload) => {
          const row = payload.new as Session;
          if (row.status === "human" && !notifiedHandoffRef.current.has(row.id)) {
            notifiedHandoffRef.current.add(row.id);
            flagAttention(row.id, row, { kind: "handoff" });
          }
          void loadSessions();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chats" },
        (payload) => {
          const row = payload.new as Session;
          const old = payload.old as Partial<Session>;
          // Ring on the bot -> human transition (fresh handoff request).
          if (row.status === "human" && old.status !== "human" && !notifiedHandoffRef.current.has(row.id)) {
            notifiedHandoffRef.current.add(row.id);
            flagAttention(row.id, row, { kind: "handoff" });
          }
          void loadSessions();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as Msg;
          // Returning visitor (cleared chat): re-arm the new-message alert.
          if (row.sender === "system" && row.content === "Visitor returned after clearing chat") {
            notifiedNewRef.current.delete(row.chat_id);
            return;
          }
          if (row.sender !== "user") return;
          const sess = sessionsRef.current.find((s) => s.id === row.chat_id);
          // WhatsApp-style: bump this chat to the top instantly.
          setSessions((prev) => {
            const next = prev.map((x) => (x.id === row.chat_id ? { ...x, last_message_at: row.created_at } : x));
            const sorted = sortByActivity(next);
            sessionsRef.current = sorted;
            return sorted;
          });
          if (!sess) void loadSessions();
          // Trigger 1: the visitor's very first message — once per session, even while on the bot.
          if (!notifiedNewRef.current.has(row.chat_id)) {
            notifiedNewRef.current.add(row.chat_id);
            if (sess?.status !== "human") {
              flagAttention(row.chat_id, sess, { kind: "new" });
              void loadSessions();
              return;
            }
          }

        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authed, flagAttention, loadSessions]);


  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  }

  const selectSession = useCallback((id: string) => {
    setActiveId(id);
    setUnreadCounts((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setAlertKinds((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    navigate({ to: "/admin", search: { session: id, tab: "chats" }, replace: true });
  }, [navigate]);

  // Desktop-notification clicks need the latest selectSession.
  useEffect(() => {
    selectSessionRef.current = selectSession;
  }, [selectSession]);

  // Ask for browser notification permission as soon as the dashboard loads.
  useEffect(() => {
    if (!authed) return;
    try {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        void Notification.requestPermission();
      }
    } catch { /* ignore */ }
  }, [authed]);

  function backToList() {
    setActiveId(null);
    navigate({ to: "/admin", search: { session: "", tab: "chats" }, replace: true });
  }

  // Deep-link: auto-select session from ?session=ID once auth is ready and sessions are loaded.
  const deepLink = search.session;
  useEffect(() => {
    if (!authed || !sessionsLoaded) return;
    if (deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deepLink);
    if (deepLink && isUuid) {
      const exists = sessions.some((s) => s.id === deepLink);
      if (exists) {
        selectSession(deepLink);
      } else {
        // Optimistically open the deep-linked session even if not in the active list yet.
        // ChatPane loads its own data and will render whatever exists.
        console.warn("[admin] deep-link session not in active list, opening anyway", deepLink);
        selectSession(deepLink);
      }
    } else if (deepLink) {
      console.warn("[admin] invalid deep-link session id, ignoring", deepLink);
    }
    console.log("Deep link initialization finished. Loading state set to false.");
  }, [authed, sessionsLoaded, deepLink, sessions, selectSession]);

  if (authed === null) {
    return <div className="admin-theme flex min-h-screen items-center justify-center bg-white text-sm text-brand-800/65">Loading…</div>;
  }

  const showListOnMobile = !activeId;
  const currentTab = search.tab;

  const goTab = (tab: TabKey) =>
    navigate({
      to: "/admin",
      search: { session: tab === "chats" ? search.session : "", tab },
      replace: true,
    });

  const navItems: Array<{
    key: TabKey;
    label: string;
    Icon: typeof MessageSquare;
  }> = [
    { key: "chats", label: "Live Chats", Icon: MessageSquare },
    { key: "quotations", label: "Quotations", Icon: FileSpreadsheet },
    { key: "meetings", label: "Meetings", Icon: CalendarDays },
    { key: "gmail", label: "Gmail", Icon: Mail },
    { key: "automations", label: "Automations", Icon: Zap },
    { key: "knowledge", label: "Knowledge Base", Icon: BookOpen },
    { key: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  return (
    <div className="admin-theme flex h-[100dvh] flex-col bg-white text-brand-800">
      <header className="flex items-center justify-between gap-2 border-b border-brand-800/15 bg-white px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {activeId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={backToList}
              className="md:hidden shrink-0"
              aria-label="Back to list"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-800 text-white">
            <Headphones className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-brand-800">Nexen Strategy — Admin</div>
            <div className="truncate text-xs text-brand-800/60">
              {sessions.length} active
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AdminStatusToggle />
          <Button
            variant={soundOn ? "outline" : "default"}
            size="sm"
            onClick={toggleSound}
            className={cn("gap-1.5", !soundOn && "bg-brand-500 text-white hover:bg-brand-500/90")}
            title={soundOn ? "Sound alerts enabled — click to turn off" : "Enable sound alerts"}
          >
            {soundOn ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{soundOn ? "Sound on" : "Sound off"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={signOut} className="gap-1.5">
            <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <nav
          className={cn(
            "hidden shrink-0 flex-col overflow-hidden border-r border-brand-800/15 bg-white md:flex",
            "transition-[width,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            sidebarCollapsed ? "w-16 px-2 py-3" : "w-56 p-3",
          )}
          aria-label="Admin navigation"
        >
          <div className={cn("mb-3 flex items-center gap-2", sidebarCollapsed ? "justify-center" : "justify-between")}>
            {!sidebarCollapsed && (
              <img
                src={nexenLogoAsset.url}
                alt="Nexen Strategy"
                className="h-8 w-auto max-w-[120px] shrink-0 object-contain"
              />
            )}
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="h-9 w-9 shrink-0 text-brand-800 transition-colors hover:bg-brand-500 hover:text-white"
                    aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    aria-expanded={!sidebarCollapsed}
                  >
                    {sidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <TooltipProvider delayDuration={250}>
            <div className="flex flex-col gap-1">
              {navItems.map(({ key, label, Icon }) => {
                const active = currentTab === key;
                const badge = key === "chats" && totalUnread > 0 ? (totalUnread > 99 ? "99+" : String(totalUnread)) : null;
                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => goTab(key)}
                        aria-label={badge ? `${label}, ${totalUnread} unread` : label}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative h-10 min-w-0 shrink-0 justify-start overflow-visible rounded-md px-3 text-sm font-medium",
                          "transition-[color,background-color,box-shadow] duration-300",
                          sidebarCollapsed && "w-12 justify-center px-0",
                          active
                            ? "bg-brand-800 text-white shadow-sm hover:bg-brand-800 hover:text-white"
                            : "text-brand-800 hover:bg-brand-500 hover:text-white",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span
                          className={cn(
                            "overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity,transform] duration-300 ease-out",
                            sidebarCollapsed
                              ? "max-w-0 -translate-x-1 opacity-0"
                              : "max-w-36 translate-x-0 opacity-100 delay-150",
                          )}
                          aria-hidden={sidebarCollapsed}
                        >
                          {label}
                        </span>
                        {badge && (
                          <span
                            className={cn(
                              "flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-800 px-1.5 text-[10px] font-bold leading-none text-white shadow",
                              sidebarCollapsed
                                ? "absolute -right-1 -top-1"
                                : "ml-auto",
                            )}
                          >
                            {badge}
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    {sidebarCollapsed && (
                      <TooltipContent side="right">{badge ? `${label} · ${badge} new` : label}</TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </nav>
        {/* Mobile top-strip nav */}
        <div className="md:hidden fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-brand-800/15 bg-white py-1.5">
          {navItems.map(({ key, label, Icon }) => {
            const active = currentTab === key;
            const badge = key === "chats" && totalUnread > 0 ? (totalUnread > 99 ? "99+" : String(totalUnread)) : null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => goTab(key)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[10px] font-medium",
                  active ? "text-brand-800" : "text-brand-800/60",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {badge && (
                  <span
                    className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-800 px-1 text-[9px] font-bold leading-none text-white"
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-1 flex-col overflow-hidden pb-14 md:pb-0">
        {currentTab === "quotations" ? (
          <QuotationsPanel />
        ) : currentTab === "meetings" ? (
          <MeetingsPanel />
        ) : currentTab === "gmail" ? (
          <GmailPanel />
        ) : currentTab === "automations" ? (
          <AutomationsPanel />
        ) : currentTab === "knowledge" ? (
          <KnowledgePanel />
        ) : currentTab === "settings" ? (
          <SettingsPanel />
        ) : (
          <div className="flex flex-1 overflow-hidden">
          <aside
            className={cn(
              "flex-col overflow-y-auto border-r border-brand-800/15 bg-white",
              "w-full md:w-[30%] md:max-w-sm lg:w-72 md:shrink-0",
              showListOnMobile ? "flex" : "hidden md:flex",
            )}
          >
            {sessions.length === 0 && (
              <div className="p-4 text-sm text-brand-800/60">No active chats right now.</div>
            )}
            <ul>
              {sessions.map((s) => {
                const unreadCount = unreadCounts[s.id] ?? 0;
                const alertKind = alertKinds[s.id];
                const needsAttention = unreadCount > 0 || Boolean(alertKind);
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => selectSession(s.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 border-b border-brand-800/10 px-4 py-3 text-left text-sm transition-colors",
                        activeId === s.id && "bg-brand-500/10",
                        needsAttention && "bg-brand-cyan/10 hover:bg-brand-500/10",
                        !needsAttention && activeId !== s.id && "hover:bg-brand-500/5",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-brand-800">
                            {formatSessionId(s.session_number, s.id)}{s.handoff_username?.trim() ? ` · ${s.handoff_username.trim()}` : ""}
                          </span>
                          {unreadCount > 0 && (
                            <span
                              className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-brand-800 px-1.5 text-[11px] font-bold leading-none text-white"
                              aria-label={`${unreadCount} unread ${unreadCount === 1 ? "message" : "messages"}`}
                            >
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                          {s.whatsapp_routed && <WhatsAppBadge />}
                          {alertKind === "handoff" ? (
                            <span
                              className="shrink-0 rounded-full bg-brand-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                            >
                              Handoff
                            </span>
                          ) : alertKind === "new" ? (
                            <span
                              className="shrink-0 rounded-full border border-brand-cyan bg-brand-cyan/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800"
                            >
                              New
                            </span>
                          ) : null}
                        </div>
                        <span className="truncate text-xs text-brand-800/60">
                          {s.handoff_topic ? `${s.handoff_topic} · ` : ""}
                          {s.user_language ?? "—"} · {formatPakistanTime(s.updated_at)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
          <main
            className={cn(
              "flex-1 flex-col min-w-0",
              showListOnMobile ? "hidden md:flex" : "flex",
            )}
          >
            {activeId ? (
              <ChatPane key={activeId} sessionId={activeId} onBack={backToList} onClosed={backToList} />
            ) : (
              <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-brand-800/60">
                Select a session to view the conversation.
              </div>
            )}
          </main>
        </div>
        )}
        </div>
      </div>
    </div>
  );
}

type KnowledgeRow = {
  id: string;
  bot_id: string;
  source_type: string;
  raw_text: string;
  created_at: string;
  updated_at: string;
};

function KnowledgePanel() {
  const list = useServerFn(listBotKnowledge);
  const ingestUrl = useServerFn(ingestUrlKnowledge);
  const ingestFile = useServerFn(ingestFileKnowledge);
  const del = useServerFn(deleteBotKnowledge);

  const [rows, setRows] = useState<KnowledgeRow[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await list();
      setRows(data as KnowledgeRow[]);
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  }, [list]);

  useEffect(() => { void refresh(); }, [refresh]);

  const submitUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await ingestUrl({ data: { url: url.trim() } });
      setUrl("");
      setMsg({ kind: "ok", text: "URL scraped and synced." });
      await refresh();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setBusy(true);
    setMsg(null);
    for (const file of arr) {
      try {
        const text = await file.text();
        await ingestFile({ data: { fileName: file.name, content: text } });
        setMsg({ kind: "ok", text: `Uploaded "${file.name}".` });
        await refresh();
      } catch (err) {
        setMsg({ kind: "err", text: (err as Error).message });
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this knowledge source?")) return;
    try {
      await del({ data: { id } });
      await refresh();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-brand-800">Knowledge Base</h1>
          <p className="text-sm text-brand-800/60">
            Feed the Nexen Strategy assistant with website content and documents.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* File upload */}
          <section
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              "rounded-xl border border-brand-800/15 bg-white p-5 shadow-sm",
            )}
          >
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-800">
              <UploadCloud className="h-4 w-4 text-brand-500" /> Upload documents
            </div>
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
                dragOver
                  ? "border-brand-cyan bg-brand-cyan/10"
                  : "border-brand-800/20 hover:border-brand-cyan hover:bg-brand-cyan/10",
              )}
            >
              <UploadCloud className={cn("h-8 w-8", dragOver ? "text-brand-500" : "text-brand-800/45")} />
              <p className="text-sm font-medium text-brand-800">
                Drag &amp; Drop PDFs, TXT, or MD files here
              </p>
              <p className="text-xs text-brand-800/60">or click to browse</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              onChange={(e) => e.target.files && void handleFiles(e.target.files)}
              disabled={busy}
              className="mt-3 block w-full text-xs text-brand-800/70 file:mr-3 file:rounded-md file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-500/90"
            />
            <p className="mt-2 text-[11px] text-brand-800/60">
              Accepts .txt and .md (max 500KB each) — PDF parsing coming soon.
            </p>
          </section>

          {/* URL upload */}
          <section className="rounded-xl border border-brand-800/15 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-800">
              <Link2 className="h-4 w-4 text-brand-500" /> Add website URL
            </div>
            <form onSubmit={submitUrl} className="flex flex-col gap-2">
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/about"
                required
              />
              <Button
                type="submit"
                disabled={busy}
                className="bg-brand-500 hover:bg-brand-500/90"
              >
                {busy ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Scraping…</>
                ) : (
                  "Scrape & Sync URL"
                )}
              </Button>
            </form>
            <p className="mt-2 text-[11px] text-brand-800/60">
              We strip scripts, navs and footers — keeping only meaningful text.
            </p>
          </section>
        </div>

        {msg && (
          <div
            className={
              msg.kind === "err"
                ? "rounded-md border border-brand-red bg-brand-red/10 p-3 text-sm text-brand-red"
                : "rounded-md border border-brand-cyan bg-brand-cyan/10 p-3 text-sm text-brand-800"
            }
          >
            {msg.text}
          </div>
        )}

        <section className="rounded-xl border border-brand-800/15 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-brand-800/15 px-5 py-3">
            <h2 className="text-sm font-semibold text-brand-800">Ingested Knowledge Sources</h2>
            <span className="text-xs text-brand-800/60">{rows.length} total</span>
          </div>
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-brand-800/60">
              No knowledge sources yet. Add a URL or upload a file to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45%]">Source Name / URL</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date Synced</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const isUrl = r.source_type === "url";
                  const Icon = isUrl ? Globe : FileText;
                  const preview = r.raw_text.replace(/\s+/g, " ").slice(0, 90);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-800/60" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-brand-800">
                              {preview || "(empty)"}
                            </p>
                            <p className="text-xs text-brand-800/60">
                              bot: {r.bot_id.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "border",
                            isUrl
                              ? "border-brand-cyan bg-brand-cyan/15 text-brand-800"
                              : "border-brand-500 bg-brand-500/10 text-brand-800",
                          )}
                        >
                          {isUrl ? "Website Link" : "Document File"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-brand-800/60">
                        {new Date(r.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge className="border border-brand-cyan bg-brand-cyan/15 text-brand-800 hover:bg-brand-cyan/20">
                          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand-cyan" />
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Synced
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-brand-red hover:bg-brand-red/10"
                          onClick={() => remove(r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const fetchConfig = useServerFn(getBotConfig);
  const saveConfig = useServerFn(updateBotConfig);
  const [prompt, setPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTemp, setSavingTemp] = useState(false);
  const [resendKey, setResendKey] = useState("");
  const [keySet, setKeySet] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchConfig();
        if (!cancelled) {
          setPrompt(data?.system_prompt ?? "");
          const t = typeof data?.temperature === "number" ? data.temperature : 0.3;
          setTemperature(Math.min(1, Math.max(0, t)));
          setSenderEmail(data?.sender_email ?? "");
          setAdminEmail(data?.admin_email ?? "");
          setKeySet(Boolean(data?.resend_api_key_set));
        }
      } catch (e) {
        console.error("[settings] load failed", e);
        toast.error("Failed to load system prompt");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchConfig]);

  async function handleSave() {
    if (!prompt.trim()) {
      toast.error("System prompt cannot be empty");
      return;
    }
    setSaving(true);
    try {
      await saveConfig({ data: { systemPrompt: prompt } });
      toast.success("System prompt update successfully!");
    } catch (e) {
      console.error("[settings] save failed", e);
      toast.error("Failed to save system prompt");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTemperature() {
    setSavingTemp(true);
    try {
      await saveConfig({ data: { temperature } });
      toast.success(`Temperature saved (${temperature.toFixed(1)})`);
    } catch (e) {
      console.error("[settings] temperature save failed", e);
      toast.error("Failed to save temperature");
    } finally {
      setSavingTemp(false);
    }
  }

  async function handleSaveEmailSettings() {
    if (adminEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
      toast.error("Enter a valid admin notification email");
      return;
    }
    setSavingEmail(true);
    try {
      await saveConfig({
        data: {
          ...(resendKey.trim() ? { resendApiKey: resendKey.trim() } : {}),
          senderEmail,
          adminEmail,
        },
      });
      if (resendKey.trim()) setKeySet(true);
      setResendKey("");
      toast.success("Email alert settings saved");
    } catch (e) {
      console.error("[settings] email settings save failed", e);
      toast.error("Failed to save email alert settings");
    } finally {
      setSavingEmail(false);
    }
  }

  const charCount = prompt.length;
  const wordCount = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;

  return (
    <div className="flex-1 overflow-auto bg-white">
      <div className="mx-auto max-w-4xl space-y-5 p-6">
        <div>
          <h1 className="text-xl font-semibold text-brand-800">Settings</h1>
          <p className="text-sm text-brand-800/60">
            Manage the master instructions that drive the chatbot LLM.
          </p>
        </div>
        <div
          className="rounded-xl border border-brand-800/15 bg-white p-6 shadow-sm"
          
        >
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-brand-800">System Prompt</h2>
            <p className="text-xs text-brand-800/60">
              This master instruction is injected as the system role for every LLM
              request. Update it here to change the bot's persona, language rules,
              or behavior instantly.
            </p>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            placeholder="Enter master instructions, character persona, and language rules here..."
            className="min-h-[420px] w-full resize-y rounded-lg border border-brand-800/20 bg-white p-4 font-mono text-sm text-brand-800 shadow-inner outline-none transition-colors focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 disabled:opacity-60"
          />
          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-brand-800/60">
              {loading ? "Loading…" : (
                <>
                  <span className="font-medium text-brand-800">{wordCount}</span> words ·{" "}
                  <span className="font-medium text-brand-800">{charCount}</span> characters
                </>
              )}
            </div>
            <Button
              onClick={handleSave}
              disabled={loading || saving}
              className="gap-1.5 bg-brand-500 text-white hover:bg-brand-500/90"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save & Deploy Prompt
            </Button>
          </div>
        </div>
        <div
          className="rounded-xl border border-brand-800/15 bg-white p-6 shadow-sm"
          
        >
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-brand-800">LLM Temperature</h2>
            <p className="text-xs text-brand-800/60">
              Controls how deterministic the model is. Lower values (0.0–0.3) keep
              it strict and on-prompt; higher values (0.7–1.0) allow more creative
              variation.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              value={[temperature]}
              min={0}
              max={1}
              step={0.1}
              disabled={loading || savingTemp}
              onValueChange={(v) => setTemperature(v[0] ?? 0)}
              className="flex-1"
            />
            <div className="w-14 rounded-md border border-brand-800/20 bg-white px-2 py-1 text-center text-sm font-mono font-medium text-brand-800">
              {temperature.toFixed(1)}
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wide text-brand-800/45">
            <span>0.0 · precise</span>
            <span>1.0 · creative</span>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleSaveTemperature}
              disabled={loading || savingTemp}
              className="gap-1.5 bg-brand-500 text-white hover:bg-brand-500/90"
            >
              {savingTemp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save Temperature
            </Button>
          </div>
        </div>
        <div
          className="rounded-xl border border-brand-800/15 bg-white p-6 shadow-sm"
          
        >
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-brand-800">Human Handoff Email Alerts</h2>
            <p className="text-xs text-brand-800/60">
              Whenever a visitor asks for a human, an instant alert email is sent to
              the address below with the session ID, timestamp and a direct link to
              the chat.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-brand-800">
                Resend API Key {keySet && <span className="text-brand-800/45">· saved</span>}
              </label>
              <Input
                type="password"
                value={resendKey}
                onChange={(e) => setResendKey(e.target.value)}
                disabled={loading}
                placeholder={keySet ? "•••••••••• (leave blank to keep current key)" : "re_..."}
                className="bg-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-brand-800">
                Sender Email Address
              </label>
              <Input
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                disabled={loading}
                placeholder="Nexen Strategy Alerts <onboarding@resend.dev>"
                className="bg-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-brand-800">
                Admin Notification Email (Receiver)
              </label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                disabled={loading}
                placeholder="you@yourdomain.com"
                className="bg-white"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleSaveEmailSettings}
              disabled={loading || savingEmail}
              className="gap-1.5 bg-brand-500 text-white hover:bg-brand-500/90"
            >
              {savingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save Email Settings
            </Button>
          </div>
        </div>
        <TeamAccessCard />
        <WhatsAppSettingsCard />
        <GmailSettingsCard />
      </div>
    </div>
  );
}



function ChatPane({ sessionId, onBack, onClosed }: { sessionId: string; onBack: () => void; onClosed: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    seenRef.current = new Set();
    setSession(null);
    void supabase
      .from("chats")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle()
      .then(({ data }) => setSession((data as Session | null) ?? null));

    void supabase
      .from("messages")
      .select("*")
      .eq("chat_id", sessionId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        console.log("Admin Panel Messages Loaded:", data);
        const rows = (data ?? []) as Msg[];
        rows.forEach((r) => seenRef.current.add(r.id));
        setMessages(rows);
      });

    const channel = supabase
      .channel(`admin:chat:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as Msg;
          if (seenRef.current.has(row.id)) return;
          seenRef.current.add(row.id);
          setMessages((m) => [...m, row]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chats", filter: `id=eq.${sessionId}` },
        (payload) => setSession(payload.new as Session),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ chat_id: sessionId, sender: "agent", content: text })
      .select("*")
      .single();
    setSending(false);
    if (!error && data) {
      const row = data as Msg;
      if (!seenRef.current.has(row.id)) {
        seenRef.current.add(row.id);
        setMessages((m) => [...m, row]);
      }
      await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
    }
  }

  async function closeSession() {
    await supabase.from("chats").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", sessionId);
    onClosed();
  }

  const hasHandoff = !!(session?.handoff_username || session?.handoff_topic || session?.handoff_queries);

  const metadataBlock = hasHandoff ? (
    <div className="rounded-lg border border-brand-cyan bg-white p-3 text-sm shadow-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-800">
        Patient request
      </div>
      <div className="grid grid-cols-1 gap-1 text-brand-800 sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <div className="font-medium text-brand-800/60">Name</div>
        <div className="break-words">{session?.handoff_username || "—"}</div>
        <div className="font-medium text-brand-800/60">Topic</div>
        <div className="break-words">{session?.handoff_topic || "—"}</div>
        <div className="font-medium text-brand-800/60">Query</div>
        <div className="whitespace-pre-wrap break-words">{session?.handoff_queries || "—"}</div>
        <div className="font-medium text-brand-800/60">Session started</div>
        <div className="break-words">{session ? formatPakistanDateTime(session.created_at) : "—"}</div>
        <div className="font-medium text-brand-800/60">Last activity</div>
        <div className="break-words">{session ? formatPakistanDateTime(session.updated_at) : "—"}</div>
        {session?.handoff_submitted_at && (
          <>
            <div className="font-medium text-brand-800/60">Handoff requested</div>
            <div className="break-words">{formatPakistanDateTime(session.handoff_submitted_at)}</div>
          </>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      <div className="flex flex-1 min-w-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-brand-800/15 bg-white px-3 py-2 text-sm sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="md:hidden shrink-0"
              aria-label="Back to list"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="truncate font-medium">
              {formatSessionId(session?.session_number, sessionId)}{session?.handoff_username?.trim() ? ` · ${session.handoff_username.trim()}` : ""}
            </div>
            {session && (
              session.is_ai_enabled !== false && session.status !== "human" ? (
                <span className="shrink-0 rounded-full bg-brand-cyan/20 px-2 py-0.5 text-[10px] font-semibold text-brand-800">AI Active</span>
              ) : (
                <span className="shrink-0 rounded-full bg-brand-800 px-2 py-0.5 text-[10px] font-semibold text-white">Human Support</span>
              )
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <label className="flex items-center gap-2 text-xs text-brand-800/70 select-none">
              <span className="hidden sm:inline">AI Assistant</span>
              <Switch
                checked={session?.is_ai_enabled !== false}
                onCheckedChange={async (checked) => {
                  const prev = session;
                  const wasHandoff = session?.status === "human" || (session as any)?.is_handoff_triggered;
                  setSession((s) => (s ? { ...s, is_ai_enabled: checked, ...(checked ? { status: "bot", is_handoff_triggered: false } : {}) } as any : s));
                  // Re-enabling AI clears the handoff so the bot replies to the next client message.
                  const patch: { is_ai_enabled: boolean; updated_at: string; status?: string; is_handoff_triggered?: boolean } = {
                    is_ai_enabled: checked,
                    updated_at: new Date().toISOString(),
                  };
                  if (checked) { patch.status = "bot"; patch.is_handoff_triggered = false; }
                  const { error } = await supabase
                    .from("chats")
                    .update(patch)
                    .eq("id", sessionId);
                  if (error) {
                    toast.error("Failed to update AI status");
                    setSession(prev ?? null);
                  } else if (checked && wasHandoff) {
                    toast.success("AI Assistant re-engaged for this session.");
                  }
                }}
                aria-label="AI Assistant"
              />
            </label>
            <Button size="sm" variant="destructive" className="bg-brand-red text-white hover:bg-brand-red/90" onClick={closeSession}>
              Close
            </Button>
          </div>
        </div>
        {session?.is_ai_enabled === false && (
          <div className="border-b border-brand-amber bg-brand-amber/15 px-3 py-2 text-xs font-medium text-brand-800 sm:px-4">
            AI is paused. You are now in Manual Takeover Mode.
          </div>
        )}
        {/* Pinned metadata header (mobile/tablet) */}
        {metadataBlock && (
          <div className="border-b border-brand-800/15 bg-white p-3 lg:hidden">
            {metadataBlock}
          </div>
        )}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-white p-3 sm:p-4">
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            {messages.map((m) => <AdminBubble key={m.id} msg={m} />)}
          </div>
        </div>
        <div className="border-t border-brand-800/15 bg-white p-3">
          <div className="mx-auto flex max-w-2xl gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Type as staff…"
              maxLength={1000}
            />
            <Button onClick={() => void send()} disabled={!input.trim() || sending} className="bg-brand-500 hover:bg-brand-500/90 shrink-0" size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {/* Desktop right-side metadata pane */}
      {metadataBlock && (
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-brand-800/15 bg-white p-4 lg:block">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-800/60 mb-2">
            Session details
          </div>
          {metadataBlock}
        </aside>
      )}
    </div>
  );
}


function AdminBubble({ msg }: { msg: Msg }) {
  if (msg.sender === "system") {
    return (
      <div className="mx-auto flex flex-col items-center rounded-lg bg-brand-amber/15 px-3 py-1 text-center text-xs text-brand-800 ring-1 ring-brand-amber">
        <span>{msg.content}</span>
        <span className="mt-0.5 text-[10px] text-brand-800/65">{formatPakistanDateTime(msg.created_at)}</span>
      </div>
    );
  }
  const isUser = msg.sender === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "justify-start" : "justify-end")}>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-cyan/20">
          <User className="h-4 w-4 text-brand-800/70" />
        </div>
      )}
      <div className={cn("flex max-w-[75%] flex-col", isUser ? "items-start" : "items-end")}>
        <div
          className={cn(
          "w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm shadow-sm",
          isUser ? "bg-white text-brand-800 ring-1 ring-brand-800/15" :
          msg.sender === "agent" ? "bg-brand-500 text-white" : "bg-brand-cyan/15 text-brand-800 ring-1 ring-brand-cyan",

          )}
        >
          {msg.sender === "bot" && (
            <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-brand-800">
              <Bot className="h-3 w-3" /> Bot
            </div>
          )}
          {msg.content}
        </div>
        <span className="mt-1 px-1 text-[10px] text-brand-800/60">{formatPakistanDateTime(msg.created_at)}</span>
      </div>
    </div>
  );
}

