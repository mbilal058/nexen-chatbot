
CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  appointment_date date NOT NULL,
  time_slot text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));
