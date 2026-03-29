CREATE TABLE IF NOT EXISTS bureau_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  bureau text NOT NULL CHECK (bureau IN ('Equifax','Experian','TransUnion','ChexSystems','Innovis','LexisNexis','Sagestream','NCTUE','EWS','CoreLogic')),
  response_date date NOT NULL,
  response_type text DEFAULT 'investigation_results' CHECK (response_type IN ('investigation_results','verification','stall_letter','procedural','frivolous','mixed')),
  source_file_url text,
  source_file_name text,
  items_disputed integer DEFAULT 0,
  items_deleted integer DEFAULT 0,
  items_updated integer DEFAULT 0,
  items_verified integer DEFAULT 0,
  violations_detected jsonb DEFAULT '[]',
  violation_count integer DEFAULT 0,
  analysis_result jsonb,
  follow_up_action text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bureau_responses_client ON bureau_responses(client_id, response_date DESC);
CREATE INDEX IF NOT EXISTS idx_bureau_responses_violations ON bureau_responses(violation_count) WHERE violation_count > 0;

ALTER TABLE bureau_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON bureau_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);