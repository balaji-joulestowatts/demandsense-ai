import { BrainCircuit, Gauge, TrendingUp, TriangleAlert } from "lucide-react";
import { type SKUData } from "@/data/forecastData";

interface PredictionOverviewProps {
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
}

function normalizeProbabilities(values: number[]) {
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  return values.map((v) => Math.round((v / sum) * 100));
}

export default function PredictionOverview({ sku, activeScenario }: PredictionOverviewProps) {
  const scenario = sku.scenarios[activeScenario];

  const week1 = scenario.forecast[0];
  const week4 = scenario.forecast[3];
  const volatilityBand = Math.round(((week4.upper - week4.lower) / Math.max(week4.demand, 1)) * 100);

  const pmi = scenario.signals.pmi;
  const bullRaw = Math.max(8, (pmi - 49.5) * 7);
  const baseRaw = Math.max(10, 100 - Math.abs(pmi - 51.5) * 20);
  const bearRaw = Math.max(8, (50.5 - pmi) * 8);
  const [bullProb, baseProb, bearProb] = normalizeProbabilities([bullRaw, baseRaw, bearRaw]);

  const alertText = scenario.signals.cancel_rate > 6
    ? "Cancel pressure is elevated"
    : scenario.signals.cancel_rate > 3
      ? "Monitor cancel trend weekly"
      : "Cancel trend is stable";

  const kpis = [
    {
      key: "week1",
      title: "Week 1 forecast",
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      value: `${week1.demand.toLocaleString()} ${sku.unit}`,
      sub: `Range ${week1.lower.toLocaleString()}–${week1.upper.toLocaleString()}`,
    },
    {
      key: "scenario",
      title: "Active scenario",
      icon: <BrainCircuit className="h-3.5 w-3.5" />,
      value: activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1),
      sub: `Peak ${scenario.peak_demand.toLocaleString()} ${sku.unit}`,
    },
    {
      key: "signal",
      title: "Signal strength",
      icon: <Gauge className="h-3.5 w-3.5" />,
      value: `PMI ${pmi.toFixed(1)}`,
      sub: `Volatility band ±${volatilityBand}%`,
    },
    {
      key: "alert",
      title: "Execution alert",
      icon: <TriangleAlert className="h-3.5 w-3.5" />,
      value: alertText,
      sub: `Commit ${scenario.planner.production_commit.toLocaleString()} ${sku.unit}/wk`,
    },
  ];

  return (
    <section className="ds-hero relative overflow-hidden rounded-2xl border border-[hsl(var(--ds-border-subtle))] p-4 sm:p-5">
      <div className="pointer-events-none absolute -top-20 -right-24 h-52 w-52 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative z-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--ds-text-tertiary))]">Prediction cockpit</p>
          <h1 className="text-xl sm:text-2xl font-semibold text-[hsl(var(--ds-text-primary))] tracking-tight">
            {sku.name} demand outlook
          </h1>
        </div>
        <span className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-blue-200/70 bg-white/70 px-3 py-1 text-xs font-medium text-[hsl(var(--ds-text-secondary))] backdrop-blur">
          <BrainCircuit className="h-3.5 w-3.5" />
          Live prediction mode
        </span>
      </div>

      <div className="relative z-10 mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        {kpis.map((item) => (
          <div key={item.key} className="ds-kpi-card-pro">
            <div className="flex items-center justify-between gap-2">
              <p className="ds-kpi-label">{item.title}</p>
              <span className="ds-mini-icon">{item.icon}</span>
            </div>
            <p className={item.key === "alert"
              ? "mt-2 text-base leading-snug font-semibold text-[hsl(var(--ds-text-primary))]"
              : "mt-2 text-[26px] leading-none font-semibold tracking-[-0.02em] text-[hsl(var(--ds-text-primary))] tabular-nums"
            }>
              {item.value}
            </p>
            <p className="ds-kpi-sub">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="relative z-10 mt-4 pro-card p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--ds-text-secondary))]">
          <TrendingUp className="h-3.5 w-3.5" /> Scenario probability blend (signal-derived)
        </div>
        <div className="space-y-2 text-xs">
          {[
            { label: "Bull", value: bullProb, color: "bg-emerald-500" },
            { label: "Base", value: baseProb, color: "bg-blue-500" },
            { label: "Bear", value: bearProb, color: "bg-amber-500" },
          ].map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex justify-between"><span>{row.label}</span><span className="font-semibold">{row.value}%</span></div>
              <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                <div className={`h-full ${row.color} shadow-[0_0_14px_rgba(37,99,235,0.35)]`} style={{ width: `${row.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
