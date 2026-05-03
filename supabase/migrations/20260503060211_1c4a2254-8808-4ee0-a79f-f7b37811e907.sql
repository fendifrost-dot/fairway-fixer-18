ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS intake_auto_extracted_at timestamptz NULL;