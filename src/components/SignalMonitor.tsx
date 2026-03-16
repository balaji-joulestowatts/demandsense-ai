import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useState } from "react";
import { type SKUData, type ScenarioSignals } from "@/data/forecastData";
import clsx from "clsx";

interface SignalMonitorProps {
  sku: SKUData;
}

const SCENARIO_IDS = ["bull", "base", "bear"] as const;
const SCENARIO_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  bull: { label: "Bull", color: "#16a34a", bg: "bg-[#dcfce7]", border: "border-[#16a34a]" },
  base: { label: "Base", color: "#2563eb", bg: "bg-[#dbeafe]", border: "border-[#2563eb]" },
  bear: { label: "Bear", color: "#d97706", bg: "bg-[#fef3c7]", border: "border-[#d97706]" },
};

const SIGNAL_EXPLANATIONS: Record<string, string> = {
  pmi: "Leading indicator 3–6 months ahead. Values above 50 signal manufacturing expansion and typically precede demand uplifts.",
  freight: "Coincident indicator of logistics capacity. Rising index signals demand-driven freight tightening and potential supply constraints.",
  backlog: "Coincident indicator of near-term order visibility. High backlog gives strong 4–6 week forecast confidence.",
  cancel: "Demand reversal signal. Spikes in cancel rate precede actual demand drops by 2–4 weeks.",
};

export default function SignalMonitor({ sku }: SignalMonitorProps) {
  const [activeScenario, setActiveScenario] = useState<"bull" | "base" | "bear">("base");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const signals: ScenarioSignals = sku.scenarios[activeScenario].signals;

  const TrendIcon = ({ trend }: { trend: "up" | "down" | "flat" }) => {
    if (trend === "up") return <TrendingUp className="w-4 h-4 stroke-[2.5px]" />;
    if (trend === "down") return <TrendingDown className="w-4 h-4 stroke-[2.5px]" />;
    return <Minus className="w-4 h-4 stroke-[2.5px]" />;
  };

  const cards = [
    {
      id: "pmi",
      label: "Manufacturing PMI",
      value: signals.pmi.toFixed(1),
      sub: "Expansion > 50",
      color: signals.pmi > 50 ? "#059669" : "#dc2626",
      extra: (
        <span style={{ color: signals.pmi > 50 ? "#059669" : "#dc2626" }}>
          <TrendIcon trend={signals.pmi_trend} />
        </span>
      ),
    },
    {
      id: "freight",
      label: "Freight Volume Index",
      value: signals.freight_index.toString(),
      sub: "Volume index (base 100)",
      color: undefined,
      extra: (
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: signals.freight_mom_pct >= 0 ? "#dcfce7" : "#fee2e2",
            color: signals.freight_mom_pct >= 0 ? "#059669" : "#dc2626",
          }}
        >
          {signals.freight_mom_pct >= 0 ? "+" : ""}
          {signals.freight_mom_pct.toFixed(1)}% MoM
        </span>
      ),
    },
    {
      id: "backlog",
      label: "Customer Backlog Days",
      value: `${signals.backlog_days}`,
      unit: "days",
      sub: "Rolling 30-day backlog",
      color: undefined,
      extra: (
        <div className="w-full h-1.5 rounded-full bg-[#f1f5f9] mt-1">
          <div
            className="h-full rounded-full ds-transition"
            style={{
              width: `${Math.min((signals.backlog_days / 70) * 100, 100)}%`,
              backgroundColor:
                signals.backlog_days > 40 ? "#059669" : signals.backlog_days >= 25 ? "#d97706" : "#dc2626",
            }}
          />
        </div>
      ),
    },
    {
      id: "cancel",
      label: "Order Cancel Rate",
      value: signals.cancel_rate.toFixed(1),
      unit: "%",
      sub: "Current period",
      color: signals.cancel_rate < 3 ? "#059669" : signals.cancel_rate <= 7 ? "#d97706" : "#dc2626",
      extra: (
        <span style={{ color: signals.cancel_rate < 3 ? "#059669" : signals.cancel_rate <= 7 ? "#d97706" : "#dc2626" }}>
          <TrendIcon trend={signals.cancel_rate > 5 ? "up" : "down"} />
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* Scenario pills */}
      <div className="flex gap-2 mb-4">
        {SCENARIO_IDS.map((id) => {
          const meta = SCENARIO_META[id];
          const isActive = activeScenario === id;
          return (
            <button
              key={id}
              onClick={() => setActiveScenario(id)}
              className={clsx(
                "px-4 py-1.5 rounded-full text-sm font-medium ds-transition border",
                isActive ? `${meta.bg} ${meta.border}` : "bg-transparent border-[#e2e8f0] text-ds-text-secondary"
              )}
              style={isActive ? { color: meta.color } : undefined}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.id}
            className="ds-card-hover p-5 cursor-pointer relative"
            onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
          >
            <p className="text-[13px] text-ds-text-secondary mb-2">{card.label}</p>
            <div className="flex items-baseline gap-2">
              <span
                className="text-3xl font-bold tracking-tight tabular-nums"
                style={{ color: card.color || "hsl(var(--ds-text-primary))" }}
              >
                {card.value}
              </span>
              {card.unit && <span className="text-sm text-ds-text-tertiary">{card.unit}</span>}
              {card.extra}
            </div>
            <p className="text-[11px] text-ds-text-tertiary mt-1">{card.sub}</p>

            {expandedCard === card.id && (
              <div className="mt-3 pt-3 border-t border-dashed text-xs text-ds-text-secondary italic leading-relaxed animate-fade-in">
                {SIGNAL_EXPLANATIONS[card.id]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
