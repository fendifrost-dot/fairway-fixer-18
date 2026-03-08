ALTER TYPE event_source ADD VALUE IF NOT EXISTS 'Creditor';

ALTER TABLE source_corrections DROP CONSTRAINT IF EXISTS source_corrections_allowed_sources;
ALTER TABLE source_corrections ADD CONSTRAINT source_corrections_allowed_sources CHECK (
  (from_source IS NULL OR from_source IN ('unassigned','experian','transunion','equifax','innovis','lexisnexis','sagestream','corelogic','chexsystems','ews','nctue','ftc','cfpb','bbb','ag','other','creditor'))
  AND
  to_source IN ('experian','transunion','equifax','innovis','lexisnexis','sagestream','corelogic','chexsystems','ews','nctue','ftc','cfpb','bbb','ag','other','creditor')
);