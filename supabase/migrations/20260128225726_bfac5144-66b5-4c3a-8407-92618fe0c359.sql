-- Create ENUM types for case_actions
CREATE TYPE public.action_category AS ENUM ('Completed', 'Response', 'ToDo');
CREATE TYPE public.action_status AS ENUM ('Done', 'Open');
CREATE TYPE public.action_priority AS ENUM ('Low', 'Medium', 'High');

-- Create the unified case_actions table
CREATE TABLE public.case_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL,
  category public.action_category NOT NULL,
  title TEXT NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status public.action_status NOT NULL DEFAULT 'Open',
  priority public.action_priority,
  details TEXT,
  related_entity TEXT,
  related_account TEXT,
  related_account_masked TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.case_actions ENABLE ROW LEVEL SECURITY;

-- Create helper function to check case access (via matters table)
CREATE OR REPLACE FUNCTION public.can_access_case(_case_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matters
    WHERE id = _case_id
    AND (owner_id = auth.uid() OR public.is_admin())
  )
$$;

-- RLS Policies
CREATE POLICY "Users can view their case actions"
  ON public.case_actions
  FOR SELECT
  TO authenticated
  USING (public.can_access_case(case_id));

CREATE POLICY "Users can insert case actions"
  ON public.case_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_case(case_id));

CREATE POLICY "Users can update their case actions"
  ON public.case_actions
  FOR UPDATE
  TO authenticated
  USING (public.can_access_case(case_id));

CREATE POLICY "Users can delete their case actions"
  ON public.case_actions
  FOR DELETE
  TO authenticated
  USING (public.can_access_case(case_id));

-- Trigger for updated_at
CREATE TRIGGER update_case_actions_updated_at
  BEFORE UPDATE ON public.case_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();