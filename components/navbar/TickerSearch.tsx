"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { searchTickers, POPULAR_TICKERS } from "@/lib/api";
import type { Ticker } from "@/types";

interface Props {
  symbol: string;
  onSelect: (symbol: string) => void;
}

export function TickerSearch({ symbol, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = query.trim() ? searchTickers(query) : POPULAR_TICKERS;

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      setFocusedIndex(-1);
    }
  }, [open]);

  // Reset focused index when results change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [query]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[focusedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  const select = useCallback((t: Ticker) => {
    onSelect(t.symbol);
    setOpen(false);
    setQuery("");
  }, [onSelect]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = focusedIndex >= 0 ? results[focusedIndex] : results[0];
      if (target) select(target);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-2 px-4 py-2 rounded cursor-pointer hover:bg-[#1e222d] transition-colors"
      >
        <span className="text-[16px] font-bold text-white tracking-tight leading-none">
          {symbol}
        </span>
        <ChevronDown
          className="w-4 h-4 text-[#787b86] group-hover:text-white transition-colors mt-px"
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={close} />

          {/* Search palette */}
          <div
            className="absolute top-full mt-1.5 left-0 z-50 w-72 rounded-xl overflow-hidden shadow-2xl"
            style={{
              background: "#1e222d",
              border: "1px solid #2a2e39",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}
          >
            {/* Search input */}
            <div
              className="flex items-center gap-2.5 px-4 py-3"
              style={{ borderBottom: "1px solid #2a2e39" }}
            >
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "#787b86" }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search symbol or company…"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#4c525e]"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 hover:text-white transition-colors" style={{ color: "#787b86" }} />
                </button>
              )}
            </div>

            {/* Results */}
            <ul ref={listRef} className="max-h-72 overflow-y-auto py-1.5">
              {results.length === 0 ? (
                <li className="px-4 py-3.5 text-sm" style={{ color: "#787b86" }}>
                  No results for &quot;{query}&quot;
                </li>
              ) : (
                results.map((t, idx) => {
                  const isActive = t.symbol === symbol;
                  const isFocused = idx === focusedIndex;
                  return (
                    <li key={t.symbol}>
                      <button
                        onClick={() => select(t)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors"
                        style={{
                          background: isFocused
                            ? "#2a2e39"
                            : isActive
                            ? "rgba(41,98,255,0.07)"
                            : "transparent",
                        }}
                        onMouseEnter={() => setFocusedIndex(idx)}
                        onMouseLeave={() => setFocusedIndex(-1)}
                      >
                        <div className="flex flex-col min-w-0">
                          <span
                            className="text-sm font-bold leading-tight"
                            style={{ color: isActive ? "#6b8cff" : "#d1d4dc" }}
                          >
                            {t.symbol}
                          </span>
                          <span
                            className="text-[11px] truncate leading-tight mt-0.5"
                            style={{ color: "#787b86" }}
                          >
                            {t.label}
                          </span>
                        </div>
                        <span
                          className="ml-auto text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded"
                          style={{
                            color: "#787b86",
                            background: "#131722",
                            border: "1px solid #2a2e39",
                          }}
                        >
                          {t.exchange}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
