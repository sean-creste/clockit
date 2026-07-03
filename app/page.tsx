import Link from "next/link";
import { brand } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./(auth)/login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let resource: { name: string; role: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from("resources")
      .select("name, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    resource = data;
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center"
      style={{ backgroundColor: brand.ink }}
    >
      <h1
        className="text-5xl font-semibold text-white"
        style={{ letterSpacing: "0.3em" }}
      >
        {brand.wordmark}
      </h1>
      <div style={{ height: 2, width: 120, backgroundColor: brand.oxblood }} />

      {user ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg text-zinc-300">
            Signed in as{" "}
            <span className="text-white">{resource?.name ?? user.email}</span>
            {resource?.role && (
              <span className="ml-2 rounded bg-zinc-800 px-2 py-0.5 text-xs uppercase tracking-wide text-zinc-300">
                {resource.role}
              </span>
            )}
          </p>
          {!resource && (
            <p className="text-sm text-amber-400">
              No resource is linked to this account yet.
            </p>
          )}
          <div className="flex gap-3">
            <Link
              href="/time"
              className="rounded-md px-4 py-2 font-medium text-white"
              style={{ backgroundColor: brand.oxblood }}
            >
              Log time
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : (
        <Link
          href="/login"
          className="rounded-md px-4 py-2 font-medium text-white"
          style={{ backgroundColor: brand.oxblood }}
        >
          Sign in
        </Link>
      )}
    </main>
  );
}
