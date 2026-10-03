ALTER TABLE public.bot_config
  ADD COLUMN IF NOT EXISTS admin_status text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_country_code text NOT NULL DEFAULT '+92',
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS whatsapp_webhook_url text;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS whatsapp_routed boolean NOT NULL DEFAULT false;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS from_email text;