ALTER TABLE public.bot_config
  ADD COLUMN IF NOT EXISTS resend_api_key text,
  ADD COLUMN IF NOT EXISTS sender_email text,
  ADD COLUMN IF NOT EXISTS admin_email text;