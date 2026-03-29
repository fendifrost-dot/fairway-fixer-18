CREATE TABLE IF NOT EXISTS score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  bureau text NOT NULL CHECK (bureau IN ('Equifax','Experian','TransUnion')),
  score integer NOT NULL,
  score_date date NOT NULL DEFAULT CURRENT_DATE,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_score_history_unique ON score_history(client_id, bureau, score_date);
CREATE INDEX IF NOT EXISTS idx_score_history_client ON score_history(client_id, score_date DESC);

ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view score history" ON score_history FOR SELECT USING (can_access_client(client_id));
CREATE POLICY "Users can insert score history" ON score_history FOR INSERT WITH CHECK (can_access_client(client_id));
CREATE POLICY "Users can update score history" ON score_history FOR UPDATE USING (can_access_client(client_id));
CREATE POLICY "Users can delete score history" ON score_history FOR DELETE USING (can_access_client(client_id));