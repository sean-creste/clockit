import { brand } from "@/lib/brand";

// Minimal branded "hello" page to prove the Cloudflare Workers deploy pipeline.
// (Replaced by the real Creste screens in later phases.)
export default function Home() {
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
      <p className="text-lg text-zinc-300">
        Time &amp; Invoicing — hello from Cloudflare Workers.
      </p>
    </main>
  );
}
