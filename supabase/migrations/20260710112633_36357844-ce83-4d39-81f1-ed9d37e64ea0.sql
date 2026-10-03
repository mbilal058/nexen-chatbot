
DROP TABLE IF EXISTS public.dental_faqs CASCADE;
DROP TABLE IF EXISTS public.clinic_info CASCADE;

CREATE TABLE public.bot_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('file', 'url', 'pdf')),
  raw_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bot_knowledge_bot_id_idx ON public.bot_knowledge(bot_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_knowledge TO authenticated;
GRANT ALL ON public.bot_knowledge TO service_role;

ALTER TABLE public.bot_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view knowledge"
  ON public.bot_knowledge FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage knowledge"
  ON public.bot_knowledge FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_bot_knowledge_updated_at
  BEFORE UPDATE ON public.bot_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
