import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/time");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div
        className="w-full max-w-sm overflow-hidden rounded-md"
        style={{
          background: brand.card,
          border: "1px solid rgba(74,14,28,.14)",
          boxShadow: "0 12px 40px -18px rgba(74,14,28,.35), 0 2px 6px rgba(0,0,0,.05)",
        }}
      >
        <div
          className="px-8 pb-6 pt-8 text-center"
          style={{ borderBottom: "1px solid rgba(74,14,28,.14)" }}
        >
          <div
            className="font-display text-oxblood"
            style={{ fontSize: 30, letterSpacing: "0.16em", lineHeight: 1 }}
          >
            {brand.wordmark}
          </div>
          <p className="mt-3 text-xs" style={{ color: "rgba(26,26,26,.5)" }}>
            Time &amp; Invoicing — sign in
          </p>
        </div>
        <div className="p-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
