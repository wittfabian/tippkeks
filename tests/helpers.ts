import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Integration tests run only when the local Supabase keys are present. */
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_KEY);

/** Service-role client (bypasses RLS) for test setup/teardown. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Create a confirmed user and return a client signed in as them (role authenticated). */
export async function createSignedInUser(
  email: string,
  password: string,
): Promise<{ client: SupabaseClient; userId: string }> {
  const admin = adminClient();
  await admin.auth.admin.createUser({ email, password, email_confirm: true });

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw error ?? new Error("Sign-in failed");
  return { client, userId: data.user.id };
}

export async function deleteUserByEmail(email: string): Promise<void> {
  const admin = adminClient();
  const { data } = await admin.auth.admin.listUsers();
  const user = data.users.find((u) => u.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}
