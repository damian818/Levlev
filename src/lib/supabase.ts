import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

// Get credentials from environment or runtime localStorage config
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  // Try to load from import.meta.env first (injected by Vite)
  const metaEnv = (import.meta as any).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL || metaEnv.VITE_PUBLIC_SUPABASE_URL || '';
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.VITE_PUBLIC_SUPABASE_ANON_KEY || '';

  // Fallback to localStorage if not in environment
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('finlev_supabase_url') || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('finlev_supabase_anon_key') || '' : '';

  const finalUrl = envUrl || localUrl;
  const finalKey = envKey || localKey;

  if (!finalUrl || !finalKey) {
    console.error('Supabase credentials missing:', { envUrl, localUrl, envKey, localKey });
  }

  return {
    url: finalUrl,
    anonKey: finalKey,
  };
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey || url.trim() === '' || anonKey.trim() === '') {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null;
}

// Google OAuth SSO Login
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { error: new Error('Supabase client is not configured. Please add your Supabase URL and Anon Key in Settings.') };
  }

  try {
    const redirectTo = window.location.origin;
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    return { error };
  } catch (err: any) {
    return { error: err };
  }
}

// Sign Out
export async function signOutFromSupabase(): Promise<{ error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) return { error: null };
  const { error } = await client.auth.signOut();
  return { error };
}

// Save Custom Supabase credentials at runtime
export function saveCustomSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem('finlev_supabase_url', url.trim());
    else localStorage.removeItem('finlev_supabase_url');

    if (anonKey) localStorage.setItem('finlev_supabase_anon_key', anonKey.trim());
    else localStorage.removeItem('finlev_supabase_anon_key');

    // Reset singleton so it reinitializes on next call
    supabaseInstance = null;
  }
}
