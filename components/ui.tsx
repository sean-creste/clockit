import Link from "next/link";
import { brand } from "@/lib/brand";

// Presentational primitives (no hooks — safe in server or client components).

type BtnVariant = "primary" | "ghost" | "accent";
const BTN_STYLE: Record<BtnVariant, React.CSSProperties> = {
  primary: { background: brand.oxblood, color: brand.light, border: "none" },
  ghost: {
    background: "transparent",
    color: "rgba(26,26,26,.6)",
    border: "1px solid rgba(26,26,26,.18)",
  },
  accent: {
    background: "transparent",
    color: brand.oxblood,
    border: "1px solid rgba(74,14,28,.3)",
  },
};

export function Btn({
  variant = "primary",
  href,
  className = "",
  style,
  children,
  small,
  ...rest
}: {
  variant?: BtnVariant;
  href?: string;
  small?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center rounded-[5px] font-medium cursor-pointer disabled:opacity-60";
  const s: React.CSSProperties = {
    fontFamily: "var(--font-archivo)",
    fontSize: small ? 11 : 12.5,
    padding: small ? "6px 12px" : "11px 18px",
    ...BTN_STYLE[variant],
    ...style,
  };
  if (href)
    return (
      <Link href={href} className={`${base} ${className}`} style={s}>
        {children}
      </Link>
    );
  return (
    <button className={`${base} ${className}`} style={s} {...rest}>
      {children}
    </button>
  );
}

const STATUS: Record<string, { c: string; bg: string }> = {
  open: { c: brand.open, bg: brand.openBg },
  billed: { c: "rgba(26,26,26,.55)", bg: "rgba(26,26,26,.08)" },
  issued: { c: brand.oxblood, bg: "rgba(74,14,28,.1)" },
  paid: { c: brand.active, bg: brand.activeBg },
  void: { c: "rgba(26,26,26,.55)", bg: "rgba(26,26,26,.08)" },
  draft: { c: "rgba(26,26,26,.55)", bg: "rgba(26,26,26,.08)" },
  active: { c: brand.active, bg: brand.activeBg },
  hourly: { c: brand.oxblood, bg: "rgba(74,14,28,.1)" },
  retainer: { c: brand.open, bg: brand.openBg },
  fixed_fee: { c: brand.oxblood, bg: "rgba(74,14,28,.1)" },
  equity: { c: "rgba(26,26,26,.55)", bg: "rgba(26,26,26,.08)" },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = STATUS[status.toLowerCase()] ?? STATUS.billed;
  return (
    <span
      className="inline-block rounded-full font-semibold uppercase"
      style={{
        fontSize: 9,
        letterSpacing: ".06em",
        padding: "3px 9px",
        color: s.c,
        background: s.bg,
      }}
    >
      {label ?? status}
    </span>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-[7px] uppercase"
      style={{ fontSize: 10, letterSpacing: ".1em", color: "rgba(26,26,26,.45)" }}
    >
      {children}
    </div>
  );
}

// Screen card header: editorial title + subtitle + optional right-side action.
export function CardHeader({
  title,
  subtitle,
  right,
  size = 28,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  size?: number;
}) {
  return (
    <div
      className="flex items-end justify-between px-8 pb-5 pt-7"
      style={{ borderBottom: "1px solid rgba(74,14,28,.14)" }}
    >
      <div>
        <div className="font-display text-ink" style={{ fontSize: size, lineHeight: 1 }}>
          {title}
        </div>
        {subtitle && (
          <div className="mt-1.5 text-xs" style={{ color: "rgba(26,26,26,.5)" }}>
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}
