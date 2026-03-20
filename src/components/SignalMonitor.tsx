import { TrendingUp, TrendingDown, Minus, Activity, Package, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { type SKUData, type ScenarioSignals } from "@/data/forecastData";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import clsx from "clsx";

// ── Design palette ──────────────────────────────────────────────────────────
const C = {
  TEAL: "hsl(var(--ds-bull))",
  AMBER: "hsl(var(--ds-warning))",
  RED: "hsl(var(--destructive))",
  BLUE: "hsl(var(--ds-base))",
  LABEL: "hsl(var(--ds-text-tertiary))",
  BODY: "hsl(var(--ds-text-secondary))",
  VALUE: "hsl(var(--ds-text-primary))",
  BORDER: "hsl(var(--border))",
  BORDER_BRIGHT: "hsl(var(--ds-border-subtle))",
  CARD: "hsl(var(--card))",
  CARD_INNER: "hsl(var(--ds-surface-muted))",
  SURFACE: "hsl(var(--secondary))",
} as const;

interface SignalMonitorProps {
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
  onScenarioChange: (scenario: "bull" | "base" | "bear") => void;
}

const SCENARIO_IDS = ["bull", "base", "bear"] as const;
const SCENARIO_META: Record<string, { label: string; color: string }> = {
  bull: { label: "Bull",  color: C.TEAL },
  base: { label: "Base",  color: C.BLUE },
  bear: { label: "Bear",  color: C.AMBER },
};

const SIGNAL_EXPLANATIONS: Record<string, string> = {
  pmi:     "Leading indicator 3–6 months ahead. Values above 50 signal manufacturing expansion and typically precede demand uplifts.",
  freight: "Coincident indicator of logistics capacity. Rising index signals demand-driven freight tightening and potential supply constraints.",
  backlog: "Coincident indicator of near-term order visibility. High backlog gives strong 4–6 week forecast confidence.",
  cancel:  "Demand reversal signal. Spikes in cancel rate precede actual demand drops by 2–4 weeks.",
};

const CARD_ICONS: Record<string, React.ElementType> = {
  pmi: Activity, freight: Package, backlog: Clock, cancel: XCircle,
};

const CARD_ACCENTS: Record<string, string> = {
  pmi: C.TEAL, freight: C.BLUE, backlog: C.AMBER, cancel: C.RED,
};

const ICON_BKGS: Record<string, { bg: string; color: string }> = {
  pmi: { bg: "hsl(var(--ds-bull) / 0.12)", color: C.TEAL },
  freight: { bg: "hsl(var(--ds-base) / 0.12)", color: C.BLUE },
  backlog: { bg: "hsl(var(--ds-warning) / 0.12)", color: C.AMBER },
  cancel: { bg: "hsl(var(--destructive) / 0.12)", color: C.RED },
};

function TrendIcon({ trend, color }: { trend: "up" | "down" | "flat"; color: string }) {
  const cls = "w-3 h-3 stroke-[2.5px]";
  if (trend === "up")   return <TrendingUp   className={cls} style={{ color }} />;
  if (trend === "down") return <TrendingDown  className={cls} style={{ color }} />;
  return <Minus className={cls} style={{ color }} />;
}

/** Generate sparkline data from a seed value and trend direction */
function makeSparkline(base: number, trend: "up" | "down" | "flat", current: number) {
  const points = 8;
  const data = [];
  for (let i = 0; i < points - 1; i++) {
    const progress = i / (points - 2);
    if (trend === "up")   data.push({ v: base + (current - base) * progress + (Math.random() - 0.4) * (current - base) * 0.15 });
    else if (trend === "down") data.push({ v: base - (base - current) * progress + (Math.random() - 0.5) * (base - current) * 0.15 });
    else data.push({ v: base + (Math.random() - 0.5) * base * 0.04 });
  }
  data.push({ v: current });
  return data;
}

export default function SignalMonitor({ sku, activeScenario, onScenarioChange }: SignalMonitorProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const signals: ScenarioSignals = sku.scenarios[activeScenario].signals;

  const pmiColor    = signals.pmi > 50 ? C.TEAL : C.RED;
  const freightColor = signals.freight_mom_pct >= 0 ? C.BLUE : C.RED;
  const cancelColor  = signals.cancel_rate < 3 ? C.TEAL : signals.cancel_rate <= 7 ? C.AMBER : C.RED;

  // Sparkline datasets
  const sparklines: Record<string, Array<{ v: number }>> = {
    pmi:     makeSparkline(48.5, "up", signals.pmi),
    freight: makeSparkline(94,  signals.freight_mom_pct >= 0 ? "up" : "down", signals.freight_index),
    backlog: makeSparkline(signals.backlog_days * 0.8, "flat", signals.backlog_days),
    cancel:  makeSparkline(Math.max(1, signals.cancel_rate - 1.5), signals.cancel_rate > 4 ? "up" : "flat", signals.cancel_rate),
  };

  const cards = [
    {
      id: "pmi",
      label: "Manufacturing PMI",
      value: signals.pmi.toFixed(1),
      unit: "",
      sub: "Expansion > 50",
      valueColor: pmiColor,
      sparkColor: pmiColor,
      badge: (
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 9999,
          background: signals.pmi > 50 ? "hsl(var(--ds-bull) / 0.12)" : "hsl(var(--destructive) / 0.12)",
          color: pmiColor,
          border: `1px solid ${signals.pmi > 50 ? "hsl(var(--ds-bull) / 0.3)" : "hsl(var(--destructive) / 0.3)"}`,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <TrendIcon trend={signals.pmi_trend} color={pmiColor} />
          {signals.pmi > 50 ? "Expanding" : "Contracting"}
        </span>
      ),
      sparkBar: null,
    },
    {
      id: "freight",
      label: "Freight Vol Index",
      value: signals.freight_index.toString(),
      unit: "",
      sub: "Base index 100",
      valueColor: C.VALUE,
      sparkColor: C.BLUE,
      badge: (
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 9999,
          background: signals.freight_mom_pct >= 0 ? "hsl(var(--ds-base) / 0.12)" : "hsl(var(--destructive) / 0.12)",
          color: freightColor,
          border: `1px solid ${signals.freight_mom_pct >= 0 ? "hsl(var(--ds-base) / 0.3)" : "hsl(var(--destructive) / 0.3)"}`,
        }}>
          {signals.freight_mom_pct >= 0 ? "+" : ""}{signals.freight_mom_pct.toFixed(1)}% MoM
        </span>
      ),
      sparkBar: null,
    },
    {
      id: "backlog",
      label: "Customer Backlog",
      value: `${signals.backlog_days}`,
      unit: "d",
      sub: "Rolling 30-day",
      valueColor: C.VALUE,
      sparkColor: C.AMBER,
      badge: null,
      sparkBar: {
        pct: Math.min((signals.backlog_days / 70) * 100, 100),
        color: signals.backlog_days > 40 ? C.TEAL : signals.backlog_days >= 25 ? C.AMBER : C.RED,
      },
    },
    {
      id: "cancel",
      label: "Order Cancel Rate",
      value: signals.cancel_rate.toFixed(1),
      unit: "%",
      sub: "Current period",
      valueColor: cancelColor,
      sparkColor: C.RED,
      badge: (
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 9999,
          background: signals.cancel_rate < 3 ? "hsl(var(--ds-bull) / 0.12)" : signals.cancel_rate <= 7 ? "hsl(var(--ds-warning) / 0.12)" : "hsl(var(--destructive) / 0.12)",
          color: cancelColor,
          border: `1px solid ${signals.cancel_rate < 3 ? "hsl(var(--ds-bull) / 0.3)" : signals.cancel_rate <= 7 ? "hsl(var(--ds-warning) / 0.3)" : "hsl(var(--destructive) / 0.3)"}`,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <TrendIcon trend={signals.cancel_rate > 5 ? "up" : "down"} color={cancelColor} />
          {signals.cancel_rate < 3 ? "Low" : signals.cancel_rate <= 7 ? "Moderate" : "High"}
        </span>
      ),
      sparkBar: null,
    },
  ];

  return (
    <section className="ds-section-card" style={{ padding: 24 }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-1">
        <div>
          <p className="ds-section-title mb-1">Signals</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.VALUE }}>Signal Monitor</h2>
          <p style={{ fontSize: 12, color: C.LABEL, marginTop: 4 }}>Real-time market indicators driving scenario weights</p>
        </div>

        {/* Scenario selector */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "hsl(var(--secondary) / 0.7)", border: `1px solid ${C.BORDER}` }}>
          {SCENARIO_IDS.map((id) => {
            const meta = SCENARIO_META[id];
            const isActive = activeScenario === id;
            return (
              <button
                key={id}
                onClick={() => onScenarioChange(id)}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold ds-transition flex items-center gap-2"
                style={
                  isActive
                    ? {
                      background:
                        meta.color === C.TEAL
                          ? "hsl(var(--ds-bull) / 0.2)"
                          : meta.color === C.BLUE
                            ? "hsl(var(--ds-base) / 0.2)"
                            : "hsl(var(--ds-warning) / 0.2)",
                      color: meta.color,
                      border: `1px solid ${meta.color}40`,
                    }
                    : { color: C.LABEL }
                }
              >
                {isActive && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />}
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="ds-section-divider mt-4" />

      {/* Signal Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = CARD_ICONS[card.id];
          const iconStyle = ICON_BKGS[card.id];
          const isExpanded = expandedCard === card.id;
          const accentColor = CARD_ACCENTS[card.id];

          return (
            <button
              key={card.id}
              className={clsx("text-left relative overflow-hidden ds-transition w-full")}
              style={{
                background: C.CARD,
                border: `1px solid ${isExpanded ? accentColor + "50" : C.BORDER}`,
                borderRadius: 14,
                boxShadow: isExpanded ? `0 0 0 1px ${accentColor}30, var(--ds-shadow-card)` : "var(--ds-shadow-card)",
              }}
              onClick={() => setExpandedCard(isExpanded ? null : card.id)}
            >
              {/* Top accent bar */}
              <span className="absolute inset-x-0 top-0 h-[3px] rounded-t-[14px]" style={{ background: accentColor }} />

              <div style={{ padding: "20px 20px 16px 20px" }}>
                {/* Icon + badge row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: iconStyle.bg }}>
                    <Icon className="w-4 h-4" style={{ color: iconStyle.color }} />
                  </div>
                  {card.badge}
                </div>

                {/* Label */}
                <p style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: C.LABEL, marginBottom: 4 }}>
                  {card.label}
                </p>

                {/* Value + sparkline row */}
                <div className="flex items-end justify-between">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span style={{ fontSize: 32, lineHeight: 1, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: card.valueColor }}>
                        {card.value}
                      </span>
                      {card.unit && (
                        <span style={{ fontSize: 16, fontWeight: 600, color: C.LABEL }}>{card.unit}</span>
                      )}
                    </div>
                    {!card.sparkBar && (
                      <p style={{ fontSize: 11, color: C.LABEL, marginTop: 4 }}>{card.sub}</p>
                    )}
                  </div>

                  {/* Sparkline */}
                  <div style={{ flexShrink: 0 }}>
                    <LineChart width={80} height={32} data={sparklines[card.id]}>
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={card.sparkColor}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </div>
                </div>

                {/* Progress bar for backlog */}
                {card.sparkBar && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ width: "100%", height: 6, borderRadius: 999, background: C.BORDER, overflow: "hidden" }}>
                      <div style={{ width: `${card.sparkBar.pct}%`, height: "100%", borderRadius: 999, backgroundColor: card.sparkBar.color, transition: "width 1s ease" }} />
                    </div>
                    <p style={{ fontSize: 11, color: C.LABEL, marginTop: 6 }}>
                      {card.sparkBar.pct.toFixed(0)}% of capacity · {card.sub}
                    </p>
                  </div>
                )}

                {/* Expanded explanation */}
                {isExpanded && (
                  <div style={{
                    marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.BORDER}`,
                    fontSize: 12, color: C.BODY, lineHeight: 1.6,
                  }}>
                    {SIGNAL_EXPLANATIONS[card.id]}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
