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
      icon: <TrendingUp className="h-4 w-4" />,
      value: `${week1.demand.toLocaleString()} ${sku.unit}`,
      sub: `Range ${week1.lower.toLocaleString()}–${week1.upper.toLocaleString()}`,
    },
    {
      key: "scenario",
      title: "Active scenario",
      icon: <BrainCircuit className="h-4 w-4" />,
      value: activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1),
      sub: `Peak ${scenario.peak_demand.toLocaleString()} ${sku.unit}`,
    },
    {
      key: "signal",
      title: "Signal strength",
      icon: <Gauge className="h-4 w-4" />,
      value: `PMI ${pmi.toFixed(1)}`,
      sub: `Volatility band ±${volatilityBand}%`,
    },
    {
      key: "alert",
      title: "Execution alert",
      icon: <TriangleAlert className="h-4 w-4" />,
      value: alertText,
      sub: `Commit ${scenario.planner.production_commit.toLocaleString()} ${sku.unit}/wk`,
    },
  ];

  return (
    <section className="bg-card rounded-xl border p-5 sm:p-6 mb-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase font-semibold tracking-wider text-muted-foreground mb-1">Prediction cockpit</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {sku.name} demand outlook
          </h1>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
          <BrainCircuit className="h-3.5 w-3.5" />
          Live prediction mode
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {kpis.map((item) => (
          <div key={item.key} className="ds-kpi-card group border border-border/70 hover:border-border">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="ds-kpi-label mb-0">{item.title}</p>
              <span className="ds-mini-icon text-muted-foreground group-hover:text-foreground transition-colors">{item.icon}</span>
            </div>
            <p className={item.key === "alert"
              ? "text-lg leading-tight font-semibold text-foreground tracking-tight"
              : "text-2xl leading-none font-bold tracking-tight text-foreground tabular-nums"
            }>
              {item.value}
            </p>
            <p className="ds-kpi-sub mt-2">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="ds-kpi-card bg-secondary/30 border-none shadow-none">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <TrendingUp className="h-4 w-4" /> Scenario probability blend (signal-derived)
        </div>
        <div className="space-y-3">
          {[
            { label: "Bull", value: bullProb, color: "bg-[hsl(var(--ds-bull))]" },
            { label: "Base", value: baseProb, color: "bg-[hsl(var(--ds-base))]" },
            { label: "Bear", value: bearProb, color: "bg-[hsl(var(--ds-bear))]" },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-4">
              <div className="w-12 text-sm font-medium text-foreground">{row.label}</div>
              <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full ${row.color} rounded-full transition-all duration-500`} style={{ width: `${row.value}%` }} />
              </div>
              <div className="w-10 text-right text-sm font-semibold tabular-nums text-muted-foreground">{row.value}%</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
