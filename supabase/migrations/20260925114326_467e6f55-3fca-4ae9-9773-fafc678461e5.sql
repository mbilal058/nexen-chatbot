CREATE SEQUENCE IF NOT EXISTS public.chats_session_number_seq;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS session_number bigint;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS last_message_at timestamptz;
WITH o AS (SELECT id, row_number() OVER (ORDER BY created_at, id) rn FROM public.chats)
UPDATE public.chats c SET session_number = o.rn FROM o WHERE o.id = c.id;
SELECT setval('public.chats_session_number_seq', GREATEST((SELECT COALESCE(MAX(session_number),0) FROM public.chats),1), (SELECT COUNT(*)>0 FROM public.chats));
ALTER TABLE public.chats ALTER COLUMN session_number SET DEFAULT nextval('public.chats_session_number_seq');
ALTER TABLE public.chats ALTER COLUMN session_number SET NOT NULL;
ALTER SEQUENCE public.chats_session_number_seq OWNED BY public.chats.session_number;
CREATE UNIQUE INDEX IF NOT EXISTS chats_session_number_key ON public.chats(session_number);
GRANT USAGE, SELECT ON SEQUENCE public.chats_session_number_seq TO service_role;
UPDATE public.chats c SET last_message_at = (SELECT MAX(created_at) FROM public.messages m WHERE m.chat_id = c.id AND m.sender='user');
CREATE INDEX IF NOT EXISTS chats_last_message_at_idx ON public.chats(last_message_at DESC NULLS LAST);