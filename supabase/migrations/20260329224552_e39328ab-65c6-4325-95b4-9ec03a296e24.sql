CREATE TABLE IF NOT EXISTS credit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  bureau text CHECK (bureau IN ('Equifax','Experian','TransUnion','Combined')),
  source_file_url text,
  source_file_name text,
  parsed_data jsonb DEFAULT '{}',
  score_at_report integer,
  account_count integer DEFAULT 0,
  negative_count integer DEFAULT 0,
  inquiry_count integer DEFAULT 0,
  analysis_result jsonb,
  previous_report_id uuid REFERENCES credit_reports(id),
  diff_summary text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_reports_client ON credit_reports(client_id, report_date DESC);

ALTER TABLE credit_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view credit reports" ON credit_reports FOR SELECT USING (can_access_client(client_id));
CREATE POLICY "Users can insert credit reports" ON credit_reports FOR INSERT WITH CHECK (can_access_client(client_id));
CREATE POLICY "Users can update credit reports" ON credit_reports FOR UPDATE USING (can_access_client(client_id));
CREATE POLICY "Users can delete credit reports" ON credit_reports FOR DELETE USING (can_access_client(client_id));