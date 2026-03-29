CREATE TABLE IF NOT EXISTS client_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  summary_type text NOT NULL DEFAULT 'progress_update' CHECK (summary_type IN ('progress_update','intake','dispute_round','final_report')),
  title text NOT NULL,
  content text NOT NULL,
  generated_by text DEFAULT 'ai',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_summaries_client ON client_summaries(client_id, created_at DESC);

ALTER TABLE client_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view client summaries" ON client_summaries FOR SELECT USING (can_access_client(client_id));
CREATE POLICY "Users can insert client summaries" ON client_summaries FOR INSERT WITH CHECK (can_access_client(client_id));
CREATE POLICY "Users can update client summaries" ON client_summaries FOR UPDATE USING (can_access_client(client_id));
CREATE POLICY "Users can delete client summaries" ON client_summaries FOR DELETE USING (can_access_client(client_id));