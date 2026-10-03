CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  cc text,
  bcc text,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  gmail_message_id text,
  gmail_thread_id text,
  error text,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage email logs" ON public.email_logs FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'admin'));