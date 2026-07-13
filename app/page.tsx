import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";
import { Btn } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/time");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <div>
        <h1
          className="font-display text-oxblood"
          style={{ fontSize: 64, letterSpacing: "0.16em", lineHeight: 1 }}
        >
          {brand.wordmark}
        </h1>
        <div
          className="mx-auto mt-5 h-0.5 w-24"
          style={{ background: brand.oxblood }}
        />
        <p className="mt-5 font-display" style={{ fontSize: 22, color: brand.ink }}>
          Time &amp; Invoicing
        </p>
        <p className="mt-2 text-sm" style={{ color: "rgba(26,26,26,.5)" }}>
          Hours logged against client work streams — billed monthly.
        </p>
      </div>
      <Btn href="/login">Sign in</Btn>
    </main>
  );
}
