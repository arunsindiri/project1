import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}

// Lazy proxy — only creates the client when first accessed at runtime
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, _receiver) {
    return (getClient() as any)[prop];
  },
});
