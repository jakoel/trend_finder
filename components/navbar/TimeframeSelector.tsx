"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { Timeframe } from "@/types";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1D", label: "1 Day" },
  { value: "1W", label: "1 Week" },
  { value: "1M", label: "1 Month" },
];

interface Props {
  selected: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export function TimeframeSelector({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = TIMEFRAMES.find((t) => t.value === selected)!;

  useEffect(() => {
    if (open) {
      const idx = TIMEFRAMES.findIndex((t) => t.value === selected);
      setFocusedIndex(idx);
    }
  }, [open, selected]);

  function select(tf: Timeframe) {
    onChange(tf);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, TIMEFRAMES.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0) select(TIMEFRAMES[focusedIndex].value);
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1.5 px-4 py-2 rounded-md cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#2962ff]"
        style={{
          fontSize: "13px",
          fontWeight: 600,
          letterSpacing: "0.02em",
          color: "#6b8cff",
          background: "rgba(41,98,255,0.10)",
          border: "1px solid rgba(41,98,255,0.18)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(41,98,255,0.18)";
          e.currentTarget.style.borderColor = "rgba(41,98,255,0.35)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(41,98,255,0.10)";
          e.currentTarget.style.borderColor = "rgba(41,98,255,0.18)";
        }}
      >
        {current.value}
        <ChevronDown
          className="w-3 h-3"
          strokeWidth={2.5}
          style={{ color: "#2962ff" }}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full mt-1.5 left-0 z-50 rounded-lg overflow-hidden py-1.5"
            style={{
              background: "#1e222d",
              border: "1px solid #2a2e39",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              minWidth: "130px",
            }}
          >
            {TIMEFRAMES.map(({ value, label }, idx) => {
              const isActive = value === selected;
              const isFocused = idx === focusedIndex;
              return (
                <button
                  key={value}
                  onClick={() => select(value)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left cursor-pointer transition-colors"
                  style={{
                    fontSize: "12px",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#6b8cff" : isFocused ? "#d1d4dc" : "#9ca3af",
                    background: isFocused || isActive
                      ? isActive
                        ? "rgba(41,98,255,0.10)"
                        : "#2a2e39"
                      : "transparent",
                  }}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  onMouseLeave={() => setFocusedIndex(-1)}
                >
                  <span>{label}</span>
                  <span style={{ color: isActive ? "#2962ff" : "#4c525e", fontSize: "11px", fontWeight: 600 }}>
                    {value}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
