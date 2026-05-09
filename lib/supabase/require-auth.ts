import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";

export async function requireUser() {
  const supabase = await createSupabaseServerAuthClient();

  if (!supabase) {
    return {
      user: null,
      error: "Supabase auth is not configured.",
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: "Authentication required. Please sign in.",
    };
  }

  return {
    user,
    error: null,
  };
}
