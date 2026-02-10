
-- 1. Idempotent enums (schema-qualified)
DO $$ BEGIN
  CREATE TYPE public.baseline_bureau AS ENUM ('Experian', 'TransUnion', 'Equifax');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.baseline_target_status AS ENUM ('pending', 'still_present', 'not_found');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. baseline_analyses table
CREATE TABLE IF NOT EXISTS public.baseline_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source_type TEXT NOT NULL CHECK (source_type IN ('note', 'pdf')),
  original_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. baseline_targets table with schema-qualified enums and item_type CHECK
CREATE TABLE IF NOT EXISTS public.baseline_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id UUID NOT NULL REFERENCES public.baseline_analyses(id) ON DELETE CASCADE,
  bureau public.baseline_bureau NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('address', 'inquiry', 'account')),
  label TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  raw_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.baseline_target_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Partial unique index (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS baseline_analyses_one_active_per_client
  ON public.baseline_analyses (client_id)
  WHERE is_active = true;

-- Dedup index
CREATE UNIQUE INDEX IF NOT EXISTS baseline_targets_baseline_fingerprint
  ON public.baseline_targets (baseline_id, fingerprint);

-- 5. Triggers (idempotent)
DROP TRIGGER IF EXISTS update_baseline_analyses_updated_at ON public.baseline_analyses;
CREATE TRIGGER update_baseline_analyses_updated_at
  BEFORE UPDATE ON public.baseline_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_baseline_targets_updated_at ON public.baseline_targets;
CREATE TRIGGER update_baseline_targets_updated_at
  BEFORE UPDATE ON public.baseline_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RLS
ALTER TABLE public.baseline_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baseline_targets ENABLE ROW LEVEL SECURITY;

-- Idempotent policies: DROP then CREATE

-- baseline_analyses SELECT
DROP POLICY IF EXISTS "Users can view baseline analyses" ON public.baseline_analyses;
CREATE POLICY "Users can view baseline analyses"
  ON public.baseline_analyses FOR SELECT
  USING (can_access_client(client_id));

-- baseline_analyses INSERT
DROP POLICY IF EXISTS "Users can insert baseline analyses" ON public.baseline_analyses;
CREATE POLICY "Users can insert baseline analyses"
  ON public.baseline_analyses FOR INSERT
  WITH CHECK (can_access_client(client_id));

-- baseline_analyses UPDATE
DROP POLICY IF EXISTS "Users can update baseline analyses" ON public.baseline_analyses;
CREATE POLICY "Users can update baseline analyses"
  ON public.baseline_analyses FOR UPDATE
  USING (can_access_client(client_id))
  WITH CHECK (can_access_client(client_id));

-- baseline_analyses DELETE
DROP POLICY IF EXISTS "Users can delete baseline analyses" ON public.baseline_analyses;
CREATE POLICY "Users can delete baseline analyses"
  ON public.baseline_analyses FOR DELETE
  USING (can_access_client(client_id));

-- baseline_targets SELECT
DROP POLICY IF EXISTS "Users can view baseline targets" ON public.baseline_targets;
CREATE POLICY "Users can view baseline targets"
  ON public.baseline_targets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.baseline_analyses ba
    WHERE ba.id = baseline_targets.baseline_id
    AND can_access_client(ba.client_id)
  ));

-- baseline_targets INSERT
DROP POLICY IF EXISTS "Users can insert baseline targets" ON public.baseline_targets;
CREATE POLICY "Users can insert baseline targets"
  ON public.baseline_targets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.baseline_analyses ba
    WHERE ba.id = baseline_targets.baseline_id
    AND can_access_client(ba.client_id)
  ));

-- baseline_targets UPDATE
DROP POLICY IF EXISTS "Users can update baseline targets" ON public.baseline_targets;
CREATE POLICY "Users can update baseline targets"
  ON public.baseline_targets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.baseline_analyses ba
    WHERE ba.id = baseline_targets.baseline_id
    AND can_access_client(ba.client_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.baseline_analyses ba
    WHERE ba.id = baseline_targets.baseline_id
    AND can_access_client(ba.client_id)
  ));

-- baseline_targets DELETE
DROP POLICY IF EXISTS "Users can delete baseline targets" ON public.baseline_targets;
CREATE POLICY "Users can delete baseline targets"
  ON public.baseline_targets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.baseline_analyses ba
    WHERE ba.id = baseline_targets.baseline_id
    AND can_access_client(ba.client_id)
  ));
