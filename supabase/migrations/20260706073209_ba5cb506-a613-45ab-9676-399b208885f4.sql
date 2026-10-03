
-- 1. Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- 2. Session access token for anonymous patients
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS access_token uuid NOT NULL DEFAULT gen_random_uuid();

-- 3. Drop legacy permissive policies
DROP POLICY IF EXISTS "messages insertable by all" ON public.chat_messages;
DROP POLICY IF EXISTS "messages readable by all" ON public.chat_messages;
DROP POLICY IF EXISTS "sessions insertable by all" ON public.chat_sessions;
DROP POLICY IF EXISTS "sessions readable by all" ON public.chat_sessions;
DROP POLICY IF EXISTS "sessions updatable by all" ON public.chat_sessions;

-- 4. Revoke anon Data API access
REVOKE ALL ON public.chat_sessions FROM anon;
REVOKE ALL ON public.chat_messages FROM anon;

-- Keep authenticated grants; RLS enforces staff-only access
GRANT SELECT, INSERT, UPDATE ON public.chat_sessions TO authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_sessions TO service_role;
GRANT ALL ON public.chat_messages TO service_role;

-- 5. Staff-only RLS policies
CREATE POLICY "staff read sessions" ON public.chat_sessions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "staff update sessions" ON public.chat_sessions
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "staff read messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "staff send messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'staff'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
    AND sender IN ('agent', 'system')
  );
