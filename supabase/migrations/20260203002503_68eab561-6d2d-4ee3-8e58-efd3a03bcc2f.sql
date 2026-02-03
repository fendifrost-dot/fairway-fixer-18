-- Allow from_source to be NULL or 'unassigned' while keeping to_source strict
ALTER TABLE public.source_corrections
DROP CONSTRAINT IF EXISTS source_corrections_allowed_sources;

ALTER TABLE public.source_corrections
ADD CONSTRAINT source_corrections_allowed_sources
CHECK (
  (
    from_source IS NULL
    OR from_source IN (
      'unassigned',
      'experian','transunion','equifax',
      'innovis','lexisnexis','sagestream','corelogic',
      'ftc','cfpb','bbb','ag'
    )
  )
  AND
  (
    to_source IN (
      'experian','transunion','equifax',
      'innovis','lexisnexis','sagestream','corelogic',
      'ftc','cfpb','bbb','ag'
    )
  )
);