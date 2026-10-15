-- Credit Guardian MCP: add the clients.create scope so an enrolled agent (Claude,
-- Cursor, Grok) can create a new client on staff request. Until now new clients
-- could only come in through the Add Client form or the Capital-site payment flow;
-- the MCP server had no create tool and the scopes allow-list had no room for one.
--
-- Pairs with supabase/functions/_shared/guardianMcp.ts (create_client tool) and
-- guardianMcpSupabase.ts (createClient store). The edge function guardian-mcp must
-- be redeployed for the tool to appear.

ALTER TABLE public.mcp_agents DROP CONSTRAINT IF EXISTS mcp_agents_scopes_check;

ALTER TABLE public.mcp_agents ADD CONSTRAINT mcp_agents_scopes_check CHECK (
  cardinality(scopes) > 0
  AND scopes <@ ARRAY[
    'clients.list',
    'clients.read',
    'timeline.read',
    'letters.read',
    'tasks.read',
    'deadlines.read',
    'clients.create',
    'clients.update',
    'timeline.write',
    'letters.draft',
    'letters.finalize',
    'tasks.complete'
  ]::text[]
);

-- Every active agent that already holds the full write set gets clients.create too.
-- Staff asked for all enrolled tools to be able to create a client on request.
-- An agent enrolled read-only, or revoked, is left alone.
UPDATE public.mcp_agents
SET scopes = array_append(scopes, 'clients.create')
WHERE revoked_at IS NULL
  AND 'clients.update' = ANY (scopes)
  AND NOT ('clients.create' = ANY (scopes));

-- matters.owner_id is NOT NULL and a BEFORE INSERT trigger overwrote it with
-- auth.uid() unconditionally. The MCP edge function runs as the service role, which
-- has no auth.uid(), so every matter it inserted would fail the NOT NULL check.
-- Keep the trigger's behavior for signed-in users (auth.uid() wins) and let a
-- service-role insert keep the owner_id it passes explicitly (the enrolling staff
-- member). RLS does not apply to the service role, so this widens nothing for
-- browser sessions.
CREATE OR REPLACE FUNCTION public.set_matters_owner_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Signed-in caller: owner is always the caller, regardless of what was passed,
  -- so RLS WITH CHECK sees the correct value. No caller (service role): keep the
  -- explicit owner_id so the NOT NULL constraint and the owner-scoped RLS on
  -- matters still hold for the staff member who enrolled the agent.
  NEW.owner_id := COALESCE(auth.uid(), NEW.owner_id);
  RETURN NEW;
END;
$$;
