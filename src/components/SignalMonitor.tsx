import { TrendingUp, TrendingDown, Minus, Activity, Package, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { type SKUData, type ScenarioSignals } from "@/data/forecastData";
import clsx from "clsx";

interface SignalMonitorProps {
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
  onScenarioChange: (scenario: "bull" | "base" | "bear") => void;
} 

const SCENARIO_IDS = ["bull", "base", "bear"] as const;
const SCENARIO_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  bull: { label: "Bull", color: "#16a34a", bg: "bg-emerald-50", border: "border-emerald-400", dot: "#16a34a" },
  base: { label: "Base", color: "#2563eb", bg: "bg-blue-50", border: "border-blue-400", dot: "#2563eb" },
  bear: { label: "Bear", color: "#d97706", bg: "bg-amber-50", border: "border-amber-400", dot: "#d97706" },
};

const SIGNAL_EXPLANATIONS: Record<string, string> = {
  pmi: "Leading indicator 3–6 months ahead. Values above 50 signal manufacturing expansion and typically precede demand uplifts.",
  freight: "Coincident indicator of logistics capacity. Rising index signals demand-driven freight tightening and potential supply constraints.",
  backlog: "Coincident indicator of near-term order visibility. High backlog gives strong 4–6 week forecast confidence.",
  cancel: "Demand reversal signal. Spikes in cancel rate precede actual demand drops by 2–4 weeks.",
};

// Map card id → icon component
const CARD_ICONS: Record<string, React.ElementType> = {
  pmi: Activity,
  freight: Package,
  backlog: Clock,
  cancel: XCircle,
};

// Accent gradients per card
const CARD_ACCENTS: Record<string, string> = {
  pmi: "from-blue-500 to-indigo-500",
  freight: "from-violet-500 to-purple-500",
  backlog: "from-amber-400 to-orange-500",
  cancel: "from-rose-400 to-red-500",
};

// Icon bg per card
const ICON_BKGS: Record<string, string> = {
  pmi: "bg-blue-50 text-blue-600",
  freight: "bg-violet-50 text-violet-600",
  backlog: "bg-amber-50 text-amber-600",
  cancel: "bg-rose-50 text-rose-500",
};

export default function SignalMonitor({ sku, activeScenario, onScenarioChange }: SignalMonitorProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const signals: ScenarioSignals = sku.scenarios[activeScenario].signals;

  const TrendIcon = ({ trend, color }: { trend: "up" | "down" | "flat"; color: string }) => {
    const cls = "w-3.5 h-3.5 stroke-[2.5px]";
    if (trend === "up") return <TrendingUp className={cls} style={{ color }} />;
    if (trend === "down") return <TrendingDown className={cls} style={{ color }} />;
    return <Minus className={cls} style={{ color }} />;
  };

  const cards = [
    {
      id: "pmi",
      label: "Manufacturing PMI",
      value: signals.pmi.toFixed(1),
      unit: "",
      sub: "Expansion > 50",
      valueColor: signals.pmi > 50 ? "#059669" : "#dc2626",
      badge: (
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
          style={{
            backgroundColor: signals.pmi > 50 ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)",
            color: signals.pmi > 50 ? "#059669" : "#dc2626",
          }}
        >
          <TrendIcon trend={signals.pmi_trend} color={signals.pmi > 50 ? "#059669" : "#dc2626"} />
          {signals.pmi > 50 ? "Expanding" : "Contracting"}
        </span>
      ),
      sparkBar: null,
    },
    {
      id: "freight",
      label: "Freight Volume Index",
      value: signals.freight_index.toString(),
      unit: "",
      sub: "Base index 100",
      valueColor: "hsl(var(--ds-text-primary))",
      badge: (
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: signals.freight_mom_pct >= 0 ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)",
            color: signals.freight_mom_pct >= 0 ? "#059669" : "#dc2626",
          }}
        >
          {signals.freight_mom_pct >= 0 ? "+" : ""}
          {signals.freight_mom_pct.toFixed(1)}% MoM
        </span>
      ),
      sparkBar: null,
    },
    {
      id: "backlog",
      label: "Customer Backlog Days",
      value: `${signals.backlog_days}`,
      unit: "d",
      sub: "Rolling 30-day backlog",
      valueColor: "hsl(var(--ds-text-primary))",
      badge: null,
      sparkBar: {
        pct: Math.min((signals.backlog_days / 70) * 100, 100),
        color:
          signals.backlog_days > 40 ? "#059669" :
            signals.backlog_days >= 25 ? "#d97706" : "#dc2626",
      },
    },
    {
      id: "cancel",
      label: "Order Cancel Rate",
      value: signals.cancel_rate.toFixed(1),
      unit: "%",
      sub: "Current period",
      valueColor:
        signals.cancel_rate < 3 ? "#059669" :
          signals.cancel_rate <= 7 ? "#d97706" : "#dc2626",
      badge: (
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
          style={{
            backgroundColor:
              signals.cancel_rate < 3 ? "rgba(5,150,105,0.1)" :
                signals.cancel_rate <= 7 ? "rgba(217,119,6,0.1)" : "rgba(220,38,38,0.1)",
            color:
              signals.cancel_rate < 3 ? "#059669" :
                signals.cancel_rate <= 7 ? "#d97706" : "#dc2626",
          }}
        >
          <TrendIcon
            trend={signals.cancel_rate > 5 ? "up" : "down"}
            color={
              signals.cancel_rate < 3 ? "#059669" :
                signals.cancel_rate <= 7 ? "#d97706" : "#dc2626"
            }
          />
          {signals.cancel_rate < 3 ? "Low" : signals.cancel_rate <= 7 ? "Moderate" : "High"}
        </span>
      ),
      sparkBar: null,
    },
  ];

  return (
    <section className="ds-section-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="ds-section-title">Signals</p>
          <h2 className="text-lg font-medium text-ds-text-primary">Signal monitor</h2>
        </div>
      </div>
      {/* Scenario pills */}
      <div className="inline-flex gap-1.5 mb-5 rounded-full border border-[hsl(var(--ds-border-subtle))] bg-white/60 p-1 backdrop-blur shadow-sm">
        {SCENARIO_IDS.map((id) => {
          const meta = SCENARIO_META[id];
          const isActive = activeScenario === id;
          return (
            <button
              key={id}
              onClick={() => onScenarioChange(id)}
              className={clsx(
                "px-4 py-1.5 rounded-full text-sm font-medium ds-transition flex items-center gap-1.5",
                isActive
                  ? `${meta.bg} ${meta.border} border shadow-sm`
                  : "bg-transparent border border-transparent text-ds-text-secondary hover:bg-white hover:shadow-sm"
              )}
              style={isActive ? { color: meta.color } : undefined}
            >
              {isActive && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: meta.dot }}
                />
              )}
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = CARD_ICONS[card.id];
          const isExpanded = expandedCard === card.id;

          return (
            <button
              key={card.id}
              className={clsx(
                "signal-card text-left relative overflow-hidden rounded-2xl border ds-transition w-full",
                isExpanded && "signal-card--expanded"
              )}
              onClick={() => setExpandedCard(isExpanded ? null : card.id)}
            >
              {/* Top gradient accent bar */}
              <span
                className={clsx(
                  "absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r",
                  CARD_ACCENTS[card.id]
                )}
              />

              <div className="p-4 pt-5">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={clsx(
                      "w-8 h-8 rounded-xl flex items-center justify-center",
                      ICON_BKGS[card.id]
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {card.badge}
                </div>

                {/* Label */}
                <p className="text-[11px] font-semibold uppercase tracking-widest text-ds-text-tertiary mb-1.5 leading-none">
                  {card.label}
                </p>

                {/* Value */}
                <div className="flex items-baseline gap-1 mt-1">
                  <span
                    className="text-[32px] leading-none font-bold tracking-[-0.035em] tabular-nums"
                    style={{ color: card.valueColor }}
                  >
                    {card.value}
                  </span>
                  {card.unit && (
                    <span className="text-base font-semibold text-ds-text-tertiary">{card.unit}</span>
                  )}
                </div>

                {/* Spark bar (backlog) */}
                {card.sparkBar && (
                  <div className="mt-3">
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full ds-transition"
                        style={{
                          width: `${card.sparkBar.pct}%`,
                          backgroundColor: card.sparkBar.color,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-ds-text-tertiary mt-1.5 font-medium">
                      {card.sparkBar.pct.toFixed(0)}% of capacity
                    </p>
                  </div>
                )}

                {/* Sub label */}
                {!card.sparkBar && (
                  <p className="text-[11px] text-ds-text-secondary mt-2 font-medium">{card.sub}</p>
                )}

                {/* Expanded explanation */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-dashed border-[hsl(var(--ds-border-subtle))] text-[11px] text-ds-text-secondary leading-relaxed animate-fade-in">
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
