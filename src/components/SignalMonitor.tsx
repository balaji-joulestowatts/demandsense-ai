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
  bull: { label: "Bull", color: "hsl(var(--ds-bull))", bg: "bg-[hsl(var(--ds-bull))]/10", border: "border-[hsl(var(--ds-bull))]/30", dot: "hsl(var(--ds-bull))" },
  base: { label: "Base", color: "hsl(var(--ds-base))", bg: "bg-[hsl(var(--ds-base))]/10", border: "border-[hsl(var(--ds-base))]/30", dot: "hsl(var(--ds-base))" },
  bear: { label: "Bear", color: "hsl(var(--ds-bear))", bg: "bg-[hsl(var(--ds-bear))]/10", border: "border-[hsl(var(--ds-bear))]/30", dot: "hsl(var(--ds-bear))" },
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

// Accent colors per card top border
const CARD_ACCENTS: Record<string, string> = {
  pmi: "bg-blue-500",
  freight: "bg-violet-500",
  backlog: "bg-amber-500",
  cancel: "bg-rose-500",
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
    const cls = "w-3 h-3 stroke-[2.5px]";
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
      label: "Freight Vol Index",
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
      label: "Customer Backlog",
      value: `${signals.backlog_days}`,
      unit: "d",
      sub: "Rolling 30-day",
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
    <section className="bg-card rounded-xl border p-5 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <p className="text-xs uppercase font-semibold tracking-wider text-muted-foreground mb-1">Signals</p>
          <h2 className="text-xl font-bold text-foreground">Signal monitor</h2>
        </div>

        {/* Scenario Selectors */}
        <div className="inline-flex gap-1 rounded-lg border bg-secondary/30 p-1">
          {SCENARIO_IDS.map((id) => {
            const meta = SCENARIO_META[id];
            const isActive = activeScenario === id;
            return (
              <button
                key={id}
                onClick={() => onScenarioChange(id)}
                className={clsx(
                  "px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2",
                  isActive
                    ? "bg-white shadow-sm ring-1 ring-border text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {isActive && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: meta.dot }}
                  />
                )}
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = CARD_ICONS[card.id];
          const isExpanded = expandedCard === card.id;

          return (
            <button
              key={card.id}
              className={clsx(
                "signal-card text-left relative overflow-hidden rounded-xl border ds-transition w-full group",
                isExpanded ? "border-primary/30 bg-primary/[0.02]" : "hover:border-border"
              )}
              onClick={() => setExpandedCard(isExpanded ? null : card.id)}
            >
              {/* Top accent line */}
              <span
                className={clsx(
                  "absolute inset-x-0 top-0 h-1 transition-opacity",
                  isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  CARD_ACCENTS[card.id]
                )}
              />

              <div className="p-4 pt-5">
                <div className="flex items-start justify-between mb-4">
                  <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", ICON_BKGS[card.id])}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {card.badge}
                </div>

                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {card.label}
                </p>

                <div className="flex items-baseline gap-1 mt-1">
                  <span
                    className="text-3xl leading-none font-bold tracking-tight tabular-nums"
                    style={{ color: card.valueColor }}
                  >
                    {card.value}
                  </span>
                  {card.unit && (
                    <span className="text-base font-semibold text-muted-foreground">{card.unit}</span>
                  )}
                </div>

                {/* Spark bar */}
                {card.sparkBar && (
                  <div className="mt-4">
                    <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full ds-transition"
                        style={{ width: `${card.sparkBar.pct}%`, backgroundColor: card.sparkBar.color }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 font-medium">
                      {card.sparkBar.pct.toFixed(0)}% of capacity
                    </p>
                  </div>
                )}

                {!card.sparkBar && (
                  <p className="text-[11px] text-muted-foreground mt-3 font-medium">{card.sub}</p>
                )}

                {/* Details drawer */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-top-2">
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
