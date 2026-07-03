"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/lib/brand";
import { Btn, Label } from "@/components/ui";
import { signIn, signUp } from "./actions";

// No <form> tag — onChange/onClick handlers only.
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
      else router.refresh();
    });
  }

  const inputStyle: React.CSSProperties = {
    fontSize: 13,
    background: "#fff",
    border: "1px solid rgba(26,26,26,.2)",
    borderRadius: 5,
    padding: "11px 13px",
    color: brand.ink,
    outline: "none",
    width: "100%",
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Email</Label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          style={inputStyle}
        />
      </div>
      <div>
        <Label>Password</Label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          style={inputStyle}
        />
      </div>

      {msg && (
        <p className="text-sm" style={{ color: brand.open }}>
          {msg}
        </p>
      )}

      <Btn variant="primary" onClick={() => run("in")} disabled={pending} className="w-full">
        {pending ? "…" : "Sign in"}
      </Btn>
      <Btn variant="ghost" onClick={() => run("up")} disabled={pending} className="w-full">
        Create account
      </Btn>
    </div>
  );
}
