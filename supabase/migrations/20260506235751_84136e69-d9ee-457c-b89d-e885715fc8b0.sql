
-- C5: Storage bucket for generated dispute letters (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-letters', 'client-letters', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated operators can manage letters under client-letters/*
CREATE POLICY "Authenticated can view client-letters"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'client-letters');

CREATE POLICY "Authenticated can upload client-letters"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client-letters');

CREATE POLICY "Authenticated can update client-letters"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'client-letters');

CREATE POLICY "Authenticated can delete client-letters"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'client-letters');
