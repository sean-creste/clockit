"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { linkResourceByEmail } from "@/lib/auth/link-resource";

export async function signIn(
  formData: FormData,
): Promise<{ error: string } | void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  // Link auth.users -> resources by email on first sign-in (idempotent).
  if (data.user) await linkResourceByEmail(data.user.id, data.user.email ?? email);

  redirect("/");
}

export async function signUp(
  formData: FormData,
): Promise<{ error?: string; message?: string } | void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // If email confirmation is disabled, a session exists immediately.
  if (data.session && data.user) {
    await linkResourceByEmail(data.user.id, data.user.email ?? email);
    redirect("/");
  }
  return { message: "Check your email to confirm your account, then sign in." };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
