
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS handoff_username text,
  ADD COLUMN IF NOT EXISTS handoff_topic text,
  ADD COLUMN IF NOT EXISTS handoff_queries text,
  ADD COLUMN IF NOT EXISTS handoff_submitted_at timestamptz;
