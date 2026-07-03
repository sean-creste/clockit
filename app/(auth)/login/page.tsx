import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main
      className="flex min-h-screen items-center justify-center p-6"
      style={{ backgroundColor: brand.ink }}
    >
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-black/40 p-8">
        <div className="mb-6 text-center">
          <h1
            className="text-2xl font-semibold text-white"
            style={{ letterSpacing: "0.3em" }}
          >
            {brand.wordmark}
          </h1>
          <div
            className="mx-auto mt-3 h-0.5 w-16"
            style={{ backgroundColor: brand.oxblood }}
          />
          <p className="mt-3 text-sm text-zinc-400">Time &amp; Invoicing — sign in</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
