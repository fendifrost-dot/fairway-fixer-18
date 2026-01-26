-- =============================================
-- CreditFlow Multi-Client Scale Database Schema
-- =============================================

-- 1. Create ENUMs for type safety
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TYPE public.matter_type AS ENUM ('Credit', 'Consulting', 'Both');
CREATE TYPE public.matter_state AS ENUM (
  'Intake', 'DisputePreparation', 'DisputeActive', 'PartialCompliance',
  'ViolationConfirmed', 'ReinsertionDetected', 'RegulatoryReview', 'Blocked',
  'FurnisherLiabilityTrack', 'EscalationEligible', 'LitigationReady', 'Resolved'
);
CREATE TYPE public.entity_type AS ENUM ('CRA', 'Furnisher', 'DataBroker', 'Agency');
CREATE TYPE public.overlay_type AS ENUM ('IdentityTheftDocumented', 'MixedFileConfirmed', 'UpstreamContainmentActive');
CREATE TYPE public.task_priority AS ENUM ('P0', 'P1', 'P2', 'P3');
CREATE TYPE public.task_status AS ENUM ('Pending', 'InProgress', 'Done', 'Blocked');
CREATE TYPE public.deadline_status AS ENUM ('Open', 'DueSoon', 'Overdue', 'Closed');
CREATE TYPE public.deadline_type AS ENUM (
  '611_30day', '611_notice', '605B_4biz', 'Reinsertion_5biz',
  'CFPB_15', 'CFPB_60', 'FollowUp'
);
CREATE TYPE public.response_type AS ENUM (
  'NoResponse', 'Boilerplate', 'Verified', 'Deleted', 'PartialDeleted',
  'Reinserted', 'MOVProvided', 'AuthBlocked', 'Other'
);
CREATE TYPE public.date_confidence AS ENUM ('Exact', 'Inferred', 'Unknown');
CREATE TYPE public.evidence_type AS ENUM ('Report', 'Portal', 'Mail', 'ClientStatement', 'Unknown');
CREATE TYPE public.violation_trigger AS ENUM (
  'Missed611Deadline', 'Reinsertion611a5B', 'Failure605B', 'NoMOV', 'Boilerplate'
);
CREATE TYPE public.client_status AS ENUM ('Active', 'Inactive', 'Pending');

-- 2. User Roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3. Profiles table for user info
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  preferred_name TEXT,
  email TEXT,
  phone TEXT,
  status client_status NOT NULL DEFAULT 'Active',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Matters table
CREATE TABLE public.matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  matter_type matter_type NOT NULL DEFAULT 'Credit',
  title TEXT NOT NULL,
  jurisdiction TEXT DEFAULT 'Federal (FCRA)',
  primary_state matter_state NOT NULL DEFAULT 'Intake',
  escalation_strategy TEXT,
  overall_reliability_rating INTEGER,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Entity Cases table
CREATE TABLE public.entity_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE NOT NULL,
  entity_type entity_type NOT NULL,
  entity_name TEXT NOT NULL,
  state matter_state NOT NULL DEFAULT 'DisputePreparation',
  last_action_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Overlays table
CREATE TABLE public.overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE NOT NULL,
  overlay_type overlay_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE NOT NULL,
  entity_case_id UUID REFERENCES public.entity_cases(id) ON DELETE SET NULL,
  related_account_id UUID,
  task_type TEXT NOT NULL,
  priority task_priority NOT NULL DEFAULT 'P2',
  due_date TIMESTAMPTZ,
  status task_status NOT NULL DEFAULT 'Pending',
  auto_generated BOOLEAN NOT NULL DEFAULT false,
  completion_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Deadlines table
CREATE TABLE public.deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE NOT NULL,
  entity_case_id UUID REFERENCES public.entity_cases(id) ON DELETE SET NULL NOT NULL,
  deadline_type deadline_type NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status deadline_status NOT NULL DEFAULT 'Open',
  source_action_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Violations table
CREATE TABLE public.violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE NOT NULL,
  entity_case_id UUID REFERENCES public.entity_cases(id) ON DELETE SET NULL NOT NULL,
  trigger violation_trigger NOT NULL,
  statutory_section TEXT NOT NULL,
  severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 5),
  evidence_attached BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Actions table (user actions logged)
CREATE TABLE public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE NOT NULL,
  entity_case_id UUID REFERENCES public.entity_cases(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_date TIMESTAMPTZ,
  date_confidence date_confidence NOT NULL DEFAULT 'Exact',
  evidence_type evidence_type NOT NULL DEFAULT 'Unknown',
  summary TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Responses table
CREATE TABLE public.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID REFERENCES public.matters(id) ON DELETE CASCADE NOT NULL,
  entity_case_id UUID REFERENCES public.entity_cases(id) ON DELETE SET NULL NOT NULL,
  received_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_type response_type NOT NULL,
  summary TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Saved Views table for dashboard filters
CREATE TABLE public.saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Security Definer Helper Functions
-- =============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Check if user owns client
CREATE OR REPLACE FUNCTION public.is_owner_of_client(_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = _client_id AND owner_id = auth.uid()
  )
$$;

-- Check access to matter (via client ownership)
CREATE OR REPLACE FUNCTION public.can_access_matter(_matter_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matters m
    JOIN public.clients c ON c.id = m.client_id
    WHERE m.id = _matter_id AND (c.owner_id = auth.uid() OR public.is_admin())
  )
$$;

-- Check access to entity case (via matter)
CREATE OR REPLACE FUNCTION public.can_access_entity_case(_entity_case_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entity_cases ec
    JOIN public.matters m ON m.id = ec.matter_id
    JOIN public.clients c ON c.id = m.client_id
    WHERE ec.id = _entity_case_id AND (c.owner_id = auth.uid() OR public.is_admin())
  )
$$;

-- =============================================
-- Enable RLS on all tables
-- =============================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies
-- =============================================

-- User Roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Only admins can manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin());

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Clients policies
CREATE POLICY "Users can view owned clients or admin" ON public.clients
  FOR SELECT USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can insert clients" ON public.clients
  FOR INSERT WITH CHECK (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update owned clients" ON public.clients
  FOR UPDATE USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can delete owned clients" ON public.clients
  FOR DELETE USING (owner_id = auth.uid() OR public.is_admin());

-- Matters policies
CREATE POLICY "Users can view matters of owned clients" ON public.matters
  FOR SELECT USING (public.can_access_matter(id));

CREATE POLICY "Users can insert matters for owned clients" ON public.matters
  FOR INSERT WITH CHECK (public.is_owner_of_client(client_id) OR public.is_admin());

CREATE POLICY "Users can update matters of owned clients" ON public.matters
  FOR UPDATE USING (public.can_access_matter(id));

CREATE POLICY "Users can delete matters of owned clients" ON public.matters
  FOR DELETE USING (public.can_access_matter(id));

-- Entity Cases policies
CREATE POLICY "Users can view entity cases" ON public.entity_cases
  FOR SELECT USING (public.can_access_matter(matter_id));

CREATE POLICY "Users can insert entity cases" ON public.entity_cases
  FOR INSERT WITH CHECK (public.can_access_matter(matter_id));

CREATE POLICY "Users can update entity cases" ON public.entity_cases
  FOR UPDATE USING (public.can_access_matter(matter_id));

CREATE POLICY "Users can delete entity cases" ON public.entity_cases
  FOR DELETE USING (public.can_access_matter(matter_id));

-- Overlays policies
CREATE POLICY "Users can view overlays" ON public.overlays
  FOR SELECT USING (public.can_access_matter(matter_id));

CREATE POLICY "Users can manage overlays" ON public.overlays
  FOR ALL USING (public.can_access_matter(matter_id));

-- Tasks policies
CREATE POLICY "Users can view tasks" ON public.tasks
  FOR SELECT USING (public.can_access_matter(matter_id));

CREATE POLICY "Users can manage tasks" ON public.tasks
  FOR ALL USING (public.can_access_matter(matter_id));

-- Deadlines policies
CREATE POLICY "Users can view deadlines" ON public.deadlines
  FOR SELECT USING (public.can_access_matter(matter_id));

CREATE POLICY "Users can manage deadlines" ON public.deadlines
  FOR ALL USING (public.can_access_matter(matter_id));

-- Violations policies
CREATE POLICY "Users can view violations" ON public.violations
  FOR SELECT USING (public.can_access_matter(matter_id));

CREATE POLICY "Users can manage violations" ON public.violations
  FOR ALL USING (public.can_access_matter(matter_id));

-- Actions policies
CREATE POLICY "Users can view actions" ON public.actions
  FOR SELECT USING (public.can_access_matter(matter_id));

CREATE POLICY "Users can manage actions" ON public.actions
  FOR ALL USING (public.can_access_matter(matter_id));

-- Responses policies
CREATE POLICY "Users can view responses" ON public.responses
  FOR SELECT USING (public.can_access_matter(matter_id));

CREATE POLICY "Users can manage responses" ON public.responses
  FOR ALL USING (public.can_access_matter(matter_id));

-- Saved Views policies
CREATE POLICY "Users can view own saved views" ON public.saved_views
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own saved views" ON public.saved_views
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- Triggers for updated_at
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_matters_updated_at BEFORE UPDATE ON public.matters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entity_cases_updated_at BEFORE UPDATE ON public.entity_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deadlines_updated_at BEFORE UPDATE ON public.deadlines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_violations_updated_at BEFORE UPDATE ON public.violations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Profile creation trigger
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  
  -- First user becomes admin, rest are staff
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Indexes for performance
-- =============================================
CREATE INDEX idx_clients_owner_id ON public.clients(owner_id);
CREATE INDEX idx_clients_status ON public.clients(status);
CREATE INDEX idx_matters_client_id ON public.matters(client_id);
CREATE INDEX idx_matters_primary_state ON public.matters(primary_state);
CREATE INDEX idx_matters_matter_type ON public.matters(matter_type);
CREATE INDEX idx_entity_cases_matter_id ON public.entity_cases(matter_id);
CREATE INDEX idx_entity_cases_entity_type ON public.entity_cases(entity_type);
CREATE INDEX idx_tasks_matter_id ON public.tasks(matter_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_deadlines_matter_id ON public.deadlines(matter_id);
CREATE INDEX idx_deadlines_due_date ON public.deadlines(due_date);
CREATE INDEX idx_deadlines_status ON public.deadlines(status);
CREATE INDEX idx_violations_matter_id ON public.violations(matter_id);
CREATE INDEX idx_actions_matter_id ON public.actions(matter_id);
CREATE INDEX idx_responses_matter_id ON public.responses(matter_id);