import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Center, Loader } from '@mantine/core';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

/**
 * Start Google sign-in. The browser leaves the app, and Google/Supabase
 * send it back to `nextPath` with a session.
 * @param {string} nextPath — app path to return to, e.g. '/campaigns'
 */
export function signInWithGoogle(nextPath = '/campaigns') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${base}${nextPath}` },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}

/** Tracks the current Supabase session and shares it with the app. */
export function AuthProvider({ children }) {
  // undefined = still checking, null = signed out
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => setSession(newSession)
    );
    return () => subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading: session === undefined,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** @returns {{ session: object|null, user: object|null, loading: boolean }} */
export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Route guard: renders child routes only when signed in, otherwise sends
 * the user to /login and remembers where they were going.
 *
 * This is a convenience, not security — the database rules (RLS) are what
 * actually protect data.
 */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Center h="100vh"><Loader /></Center>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
