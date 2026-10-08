-- A new auth user gets a profile and nothing else.
-- Public sign-up is also off in Supabase Auth settings. This function is the
-- backstop: an invited or dashboard-created user is not staff until an admin
-- inserts a user_roles row.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates a profile for a new auth user. Does not grant staff or admin.';
