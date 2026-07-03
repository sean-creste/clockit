"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/lib/brand";
import { signIn, signUp } from "./actions";

// No <form> tag — onChange/onClick handlers only (consistent with the /time surface).
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function run(kind: "in" | "up") {
    setMsg(null);
    start(async () => {
      const fd = new FormData();
      fd.set("email", email);
      fd.set("password", password);
      const res = kind === "in" ? await signIn(fd) : await signUp(fd);
      if (res && "error" in res && res.error) setMsg(res.error);
      else if (res && "message" in res && res.message) setMsg(res.message);
      else router.refresh(); // success path normally redirects server-side
    });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-zinc-300">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-zinc-400"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-zinc-300">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-zinc-400"
        />
      </label>

      {msg && <p className="text-sm text-amber-400">{msg}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={() => run("in")}
        className="rounded-md px-3 py-2 font-medium text-white disabled:opacity-60"
        style={{ backgroundColor: brand.oxblood }}
      >
        {pending ? "…" : "Sign in"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run("up")}
        className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 disabled:opacity-60"
      >
        Create account
      </button>
    </div>
  );
}
