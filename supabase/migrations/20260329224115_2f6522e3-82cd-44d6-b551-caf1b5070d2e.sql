CREATE TABLE IF NOT EXISTS client_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  creditor_name text NOT NULL,
  account_number text,
  account_type text,
  balance numeric(12,2),
  credit_limit numeric(12,2),
  payment_status text,
  date_opened date,
  reported_date date,
  bureau text CHECK (bureau IN ('Equifax','Experian','TransUnion')),
  dispute_status text DEFAULT 'none' CHECK (dispute_status IN ('none','pending','in_progress','resolved','verified','deleted')),
  dispute_reason text,
  dispute_date date,
  dispute_result text,
  notes text,
  is_negative boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_accounts_client ON client_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_accounts_dispute ON client_accounts(dispute_status) WHERE dispute_status != 'none';

ALTER TABLE client_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view client accounts" ON client_accounts FOR SELECT USING (can_access_client(client_id));
CREATE POLICY "Users can insert client accounts" ON client_accounts FOR INSERT WITH CHECK (can_access_client(client_id));
CREATE POLICY "Users can update client accounts" ON client_accounts FOR UPDATE USING (can_access_client(client_id));
CREATE POLICY "Users can delete client accounts" ON client_accounts FOR DELETE USING (can_access_client(client_id));

CREATE TRIGGER update_client_accounts_updated_at BEFORE UPDATE ON client_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();