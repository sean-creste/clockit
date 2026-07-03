import Link from "next/link";
import { brand } from "@/lib/brand";
import { signOut } from "@/app/(auth)/login/actions";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const NAV: { key: string; href: string; label: string; adminOnly?: boolean }[] = [
  { key: "time", href: "/time", label: "Time" },
  { key: "entries", href: "/entries", label: "Entries" },
  { key: "clients", href: "/clients", label: "Clients", adminOnly: true },
  { key: "invoices", href: "/invoices", label: "Invoices", adminOnly: true },
];

// App chrome: editorial top bar (wordmark · nav · user) over the warm paper,
// with the page's content rendered inside a card.
export function AppShell({
  active,
  section,
  userName,
  role,
  children,
  card = true,
}: {
  active: string;
  section?: string;
  userName: string;
  role: "admin" | "member";
  children: React.ReactNode;
  card?: boolean;
}) {
  const isAdmin = role === "admin";
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 pb-3 pt-6 md:px-6">
        <div className="flex items-baseline gap-4">
          <Link
            href="/"
            className="font-display text-2xl text-oxblood"
            style={{ letterSpacing: "0.16em" }}
          >
            {brand.wordmark}
          </Link>
          {section && (
            <span className="text-xs" style={{ color: "rgba(26,26,26,.4)" }}>
              / {section}
            </span>
          )}
        </div>
        <div className="flex items-center gap-5">
          <nav className="hidden items-center gap-4 sm:flex">
            {items.map((n) => (
              <Link
                key={n.key}
                href={n.href}
                className="text-xs"
                style={{
                  color: n.key === active ? brand.oxblood : "rgba(26,26,26,.55)",
                  fontWeight: n.key === active ? 600 : 400,
                }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs sm:inline" style={{ color: "rgba(26,26,26,.55)" }}>
              {userName}
            </span>
            <span
              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-semibold"
              style={{ background: brand.oxblood, color: brand.light }}
            >
              {initialsOf(userName)}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-xs underline"
                style={{ color: "rgba(26,26,26,.4)" }}
                title="Sign out"
              >
                exit
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-20 md:px-6">
        {card ? (
          <div
            className="overflow-hidden rounded-md"
            style={{
              background: brand.card,
              border: "1px solid rgba(74,14,28,.14)",
              boxShadow:
                "0 12px 40px -18px rgba(74,14,28,.35), 0 2px 6px rgba(0,0,0,.05)",
            }}
          >
            {children}
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
