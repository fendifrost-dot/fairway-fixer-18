import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberDevice?: boolean) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const debugAuth =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debugAuth') === '1';

    // Set up auth state listener FIRST (for ongoing changes)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        if (debugAuth) {
          console.info('AUTH_DEBUG onAuthStateChange', {
            event,
            hasSession: !!session,
            userId: session?.user?.id ?? null,
            expiresAt: session?.expires_at ?? null,
          });
        }

        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // THEN check for existing session (controls loading state)
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (debugAuth) {
          console.info('AUTH_DEBUG getSession(initial)', {
            hasSession: !!session,
            userId: session?.user?.id ?? null,
            expiresAt: session?.expires_at ?? null,
            error: error ? { message: (error as any).message ?? String(error) } : null,
            storage: {
              hasSupabaseAuthTokenKey:
                typeof window !== 'undefined'
                  ? Object.keys(localStorage).some((k) => k.includes('supabase') && k.includes('auth'))
                  : null,
            },
          });
        }
        
        if (error) {
          console.error('Auth initialization error:', error);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Unexpected auth error:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string, rememberDevice: boolean = true) => {
    try {
      // Store preference for session persistence
      if (!rememberDevice) {
        sessionStorage.setItem('session_temporary', 'true');
      } else {
        sessionStorage.removeItem('session_temporary');
      }

      const debugAuth =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('debugAuth') === '1';

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (debugAuth) {
        console.info('AUTH_DEBUG signInWithPassword', {
          hasSession: !!data?.session,
          userId: data?.session?.user?.id ?? null,
          error: error ? { message: error.message, status: (error as any).status } : null,
        });
      }

      // IMPORTANT: if auth returns no error but also no session, the UI will bounce back to /auth.
      // Treat this as an actionable error message for the user (usually unverified email).
      if (!error && !data?.session) {
        return {
          error: new Error(
            'Signed in but no session was created. This usually means the email address is not verified yet (or sign-in is blocked by auth settings).'
          ),
        };
      }

      return { error: error as Error | null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });
      return { error: error as Error | null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
