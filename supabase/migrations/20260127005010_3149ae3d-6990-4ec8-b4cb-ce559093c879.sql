-- Add intake fields to matters table for storing verbatim intake text
ALTER TABLE public.matters 
ADD COLUMN IF NOT EXISTS intake_raw_text text,
ADD COLUMN IF NOT EXISTS intake_source text DEFAULT 'Manual',
ADD COLUMN IF NOT EXISTS intake_created_at timestamp with time zone;

-- Add comment to document the immutable nature of intake_raw_text
COMMENT ON COLUMN public.matters.intake_raw_text IS 'Immutable verbatim intake text - source of truth artifact, never modify';
COMMENT ON COLUMN public.matters.intake_source IS 'Source of intake: Narrative / ChatGPT, Manual, etc.';
COMMENT ON COLUMN public.matters.intake_created_at IS 'Timestamp when intake was captured';