import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: price >= 1000 ? 2 : price >= 1 ? 2 : 4,
  }).format(price);
}

export function formatChange(current: number, previous: number) {
  const change = current - previous;
  const pct = previous !== 0 ? (change / previous) * 100 : 0;
  const sign = change >= 0 ? "+" : "";
  return {
    change,
    pct,
    label: `${sign}${change.toFixed(2)} (${sign}${pct.toFixed(2)}%)`,
    isPositive: change >= 0,
  };
}

export function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return String(vol);
}
