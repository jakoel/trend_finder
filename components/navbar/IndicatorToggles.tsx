"use client";

import { Zap, Shield, GitBranch, Activity, Filter } from "lucide-react";
import type { IndicatorSettings } from "@/types";
import type { LucideIcon } from "lucide-react";

const TOGGLES: {
  key: keyof IndicatorSettings;
  label: string;
  title: string;
  Icon: LucideIcon;
  activeColor: string;
  activeGlow: string;
  activeBg: string;
  activeBorder: string;
}[] = [
  {
    key: "showSignals",
    label: "Signals",
    title: "Buy / Sell signal markers",
    Icon: Zap,
    activeColor: "#facc15",
    activeGlow: "rgba(250,204,21,0.18)",
    activeBg: "rgba(250,204,21,0.08)",
    activeBorder: "rgba(250,204,21,0.35)",
  },
  {
    key: "showATRStop",
    label: "ATR Stop",
    title: "ATR trailing stop line",
    Icon: Shield,
    activeColor: "#34d399",
    activeGlow: "rgba(52,211,153,0.18)",
    activeBg: "rgba(52,211,153,0.08)",
    activeBorder: "rgba(52,211,153,0.35)",
  },
  {
    key: "showDivergence",
    label: "Divergence",
    title: "RSI & MACD divergence markers",
    Icon: GitBranch,
    activeColor: "#6b8cff",
    activeGlow: "rgba(107,140,255,0.18)",
    activeBg: "rgba(41,98,255,0.10)",
    activeBorder: "rgba(41,98,255,0.4)",
  },
  {
    key: "showMomentum",
    label: "Momentum",
    title: "Momentum fading markers",
    Icon: Activity,
    activeColor: "#fb923c",
    activeGlow: "rgba(251,146,60,0.18)",
    activeBg: "rgba(251,146,60,0.08)",
    activeBorder: "rgba(251,146,60,0.35)",
  },
  {
    key: "useADXFilter",
    label: "ADX",
    title: "ADX choppiness gate (scoring only)",
    Icon: Filter,
    activeColor: "#c084fc",
    activeGlow: "rgba(192,132,252,0.18)",
    activeBg: "rgba(192,132,252,0.08)",
    activeBorder: "rgba(192,132,252,0.35)",
  },
];

interface Props {
  settings: IndicatorSettings;
  onChange: (next: IndicatorSettings) => void;
}

export function IndicatorToggles({ settings, onChange }: Props) {
  function toggle(key: keyof IndicatorSettings) {
    onChange({ ...settings, [key]: !settings[key] });
  }

  return (
    <div className="flex items-center gap-1.5">
      {TOGGLES.map(({ key, label, title, Icon, activeColor, activeGlow, activeBg, activeBorder }) => {
        const active = settings[key];
        return (
          <button
            key={key}
            title={title}
            onClick={() => toggle(key)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md cursor-pointer select-none transition-all duration-150 outline-none focus-visible:ring-1 focus-visible:ring-white/20"
            style={
              active
                ? {
                    color: activeColor,
                    background: activeBg,
                    border: `1px solid ${activeBorder}`,
                    boxShadow: `0 0 8px ${activeGlow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  }
                : {
                    color: "#4c525e",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid #252932",
                  }
            }
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.color = "#787b86";
                e.currentTarget.style.borderColor = "#3d4358";
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.color = "#4c525e";
                e.currentTarget.style.borderColor = "#252932";
                e.currentTarget.style.background = "rgba(255,255,255,0.02)";
              }
            }}
          >
            <Icon
              className="w-3 h-3 shrink-0"
              strokeWidth={active ? 2.5 : 2}
            />
            <span style={{ fontSize: "11px", fontWeight: active ? 600 : 500, letterSpacing: "0.02em" }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
