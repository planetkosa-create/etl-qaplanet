import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serverClient: SupabaseClient | null = null;

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    url,
    anonKey,
    serviceRoleKey,
    key: serviceRoleKey || anonKey,
    hasServiceRole: Boolean(serviceRoleKey),
    isConfigured: Boolean(url && (serviceRoleKey || anonKey)),
  };
}

export function isSupabaseConfigured() {
  return getSupabaseEnv().isConfigured;
}

export function getSupabaseServerClient() {
  const env = getSupabaseEnv();

  if (!env.url || !env.key) {
    return null;
  }

  if (!serverClient) {
    serverClient = createClient(env.url, env.key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serverClient;
}
