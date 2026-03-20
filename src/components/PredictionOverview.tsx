import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { type SKUData } from "@/data/forecastData";
import InfoTooltip from "./InfoTooltip";

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
  SURFACE: "hsl(var(--secondary))",
  CARD: "hsl(var(--card))",
  CARD_INNER: "hsl(var(--ds-surface-muted))",
} as const;

interface PredictionOverviewProps {
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
}

function normalizeProbabilities(values: number[]) {
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  return values.map((v) => Math.round((v / sum) * 100));
}

/** SVG circular confidence gauge */
function ConfidenceRing({ value }: { value: number }) {
  const color = value >= 85 ? C.TEAL : value >= 70 ? C.AMBER : C.RED;
  const radius = 20;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 56, height: 56 }}>
      <svg className="absolute inset-0 -rotate-90" width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={radius} stroke="hsl(var(--ds-text-tertiary) / 0.25)" strokeWidth="4" fill="none" />
        <circle
          cx="28" cy="28" r={radius}
          stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", color }}>{value}%</span>
    </div>
  );
}

export default function PredictionOverview({ sku, activeScenario }: PredictionOverviewProps) {
  const scenario = sku.scenarios[activeScenario];
  const week1 = scenario.forecast[0];
  const week4 = scenario.forecast[3];

  const pmi = scenario.signals.pmi;
  const bullRaw = Math.max(8, (pmi - 49.5) * 7);
  const baseRaw = Math.max(10, 100 - Math.abs(pmi - 51.5) * 20);
  const bearRaw = Math.max(8, (50.5 - pmi) * 8);
  const [bullProb, baseProb, bearProb] = normalizeProbabilities([bullRaw, baseRaw, bearRaw]);

  const trendPct = ((week1.demand - week4.demand) / Math.max(week4.demand, 1)) * 100;
  const monthlyCommit = scenario.planner.production_commit * 4;
  const confidence = scenario.planner.alignment_confidence;
  const confColor = confidence >= 85 ? C.TEAL : confidence >= 70 ? C.AMBER : C.RED;

  // Donut: Base leads with teal, Bull=amber, Bear=slate
  const donutData = [
    { name: "Base", value: baseProb, color: C.TEAL },
    { name: "Bull", value: bullProb, color: C.AMBER },
    { name: "Bear", value: bearProb, color: "hsl(var(--ds-bear))" },
  ];

  const kpis = [
    {
      emoji: "📈",
      label: "Orders Received",
      value: week1.demand.toLocaleString(),
      pct: trendPct,
      sub: `${sku.unit} · Week 1`,
      isConfidence: false,
    },
    {
      emoji: "🚚",
      label: "Orders Shipped",
      value: scenario.planner.production_commit.toLocaleString(),
      pct: scenario.signals.freight_mom_pct,
      sub: `${sku.unit} committed/wk`,
      isConfidence: false,
    },
    {
      emoji: null,
      label: "Confidence",
      value: `${confidence}%`,
      pct: confidence - 75,
      sub: "Alignment score",
      isConfidence: true,
    },
  ];

  return (
    <section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">

        {/* ── Monthly Forecast hero ── */}
        <div
          className="lg:col-span-4 relative"
          style={{
            background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--ds-surface-muted)) 100%)",
            minHeight: 200,
            border: `1px solid ${C.BORDER}`,
            borderRadius: 14,
            boxShadow: "var(--ds-shadow-card)",
          }}
        >
          {/* Ambient glows */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: 14 }}>
            <div
              className="absolute bottom-0 right-0"
              style={{
                width: 180,
                height: 180,
                background: "radial-gradient(circle, hsl(var(--ds-warning) / 0.18) 0%, transparent 65%)",
                transform: "translate(35%, 35%)",
              }}
            />
            <div
              className="absolute top-3 right-8"
              style={{
                width: 90,
                height: 90,
                background: "radial-gradient(circle, hsl(var(--ds-bull) / 0.18) 0%, transparent 70%)",
              }}
            />
          </div>

          <div className="relative z-10 p-6 h-full flex flex-col justify-between" style={{ minHeight: 200 }}>
            <div>
              <div className="flex items-center gap-1.5 mb-12">
                <p style={{ color: C.LABEL, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 0 }}>Monthly Forecast</p>
                <InfoTooltip description="The total planned production commitment for this exact scenario over the next 4 weeks." />
              </div>
              <div className="flex items-start gap-3">
                <p style={{ fontSize: 40, fontWeight: 700, color: C.VALUE, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {monthlyCommit.toLocaleString()}
                </p>
                <span
                  className="mt-1 flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: trendPct >= 0 ? "hsl(var(--ds-bull) / 0.16)" : "hsl(var(--destructive) / 0.16)",
                    color: trendPct >= 0 ? C.TEAL : C.RED,
                    border: `1px solid ${trendPct >= 0 ? "hsl(var(--ds-bull) / 0.35)" : "hsl(var(--destructive) / 0.35)"}`,
                  }}
                >
                  {trendPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(trendPct).toFixed(1)}%
                </span>
              </div>
              <p style={{ color: C.BODY, fontSize: 12, marginTop: 8 }}>
                {sku.unit} · {activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)} case
              </p>
            </div>
          </div>
        </div>

        {/* ── Scenario Blend donut ── */}
        <div className="lg:col-span-3 ds-card flex flex-col" style={{ padding: 20 }}>
          <p className="ds-section-title mb-1">Scenario Blend</p>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.VALUE, marginBottom: 12 }}>Signal-derived probability</h3>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative" style={{ width: 180, height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <filter id="teal-glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <Pie
                    data={donutData}
                    cx="50%" cy="50%"
                    innerRadius="58%" outerRadius="82%"
                    paddingAngle={3}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    strokeWidth={0}
                    animationBegin={0}
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    {donutData.map((entry, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={entry.color}
                        style={i === 0 ? { filter: "drop-shadow(0 0 6px rgba(0,212,160,0.5))" } : undefined}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p style={{ fontSize: 28, fontWeight: 800, color: C.VALUE, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{baseProb}%</p>
                <p style={{ fontSize: 11, color: C.TEAL, fontWeight: 600, marginTop: 2 }}>Base</p>
                <p style={{ fontSize: 10, color: C.LABEL }}>likely</p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-5 mt-2">
            {donutData.map((d) => (
              <div key={d.name} className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.LABEL }}>{d.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: d.color }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Forecast Overview KPIs ── */}
        <div className="lg:col-span-5 ds-card" style={{ padding: 20 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="ds-section-title mb-0">Forecast Overview</p>
            <InfoTooltip description="KPIs bridging execution with planning. E.g. Confidence compares orders against actual production." />
          </div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.VALUE, marginBottom: 20 }}>Key demand & supply signals</h3>

          <div className="grid grid-cols-2 gap-5">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  {kpi.isConfidence ? (
                    <ConfidenceRing value={confidence} />
                  ) : (
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ background: C.SURFACE }}>
                      {kpi.emoji}
                    </div>
                  )}
                  {kpi.isConfidence ? (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
                      background: confidence >= 85 ? "hsl(var(--ds-bull) / 0.12)" : confidence >= 70 ? "hsl(var(--ds-warning) / 0.12)" : "hsl(var(--destructive) / 0.12)",
                      color: confColor,
                    }}>
                      {confidence >= 85 ? "Strong" : confidence >= 70 ? "Moderate" : "Weak"}
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999,
                      display: "flex", alignItems: "center", gap: 2,
                      background: kpi.pct >= 0 ? "hsl(var(--ds-bull) / 0.12)" : "hsl(var(--destructive) / 0.12)",
                      color: kpi.pct >= 0 ? C.TEAL : C.RED,
                    }}>
                      {kpi.pct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(kpi.pct).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: C.VALUE, lineHeight: 1.2 }}>{kpi.value}</p>
                  <p style={{ fontSize: 11, color: C.LABEL, marginTop: 2 }}>{kpi.label}</p>
                  <p style={{ fontSize: 10, color: C.BODY, marginTop: 2 }}>{kpi.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
