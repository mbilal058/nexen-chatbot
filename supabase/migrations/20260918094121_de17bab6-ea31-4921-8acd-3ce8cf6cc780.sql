-- Remove Bright Smile tables
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_sessions CASCADE;
TRUNCATE TABLE public.bot_knowledge;
UPDATE public.bot_config SET system_prompt = '';

-- QUOTATIONS
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text,
  contact text,
  main_services text[] NOT NULL DEFAULT '{}',
  sub_categories text[] NOT NULL DEFAULT '{}',
  budget text,
  currency text NOT NULL DEFAULT 'PKR',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT INSERT ON public.quotations TO anon;
GRANT ALL ON public.quotations TO service_role;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can submit a quotation" ON public.quotations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "staff read quotations" ON public.quotations FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff update quotations" ON public.quotations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin'));

-- MEETINGS
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text,
  contact text,
  services text[] NOT NULL DEFAULT '{}',
  date text NOT NULL,
  time text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT INSERT ON public.meetings TO anon;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can book a meeting" ON public.meetings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "staff read meetings" ON public.meetings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff update meetings" ON public.meetings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin'));

-- CHATS
CREATE TABLE public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'bot',
  user_language text,
  is_ai_enabled boolean NOT NULL DEFAULT true,
  is_handoff_triggered boolean NOT NULL DEFAULT false,
  handoff_username text,
  handoff_topic text,
  handoff_queries text,
  handoff_submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read chats" ON public.chats FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff update chats" ON public.chats FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_chat_id_created_at_idx ON public.messages (chat_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read messages" ON public.messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin')) AND sender = ANY (ARRAY['agent','system']));

-- Realtime
ALTER TABLE public.chats REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.quotations REPLICA IDENTITY FULL;
ALTER TABLE public.meetings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats, public.messages, public.quotations, public.meetings;