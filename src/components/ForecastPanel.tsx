import { useState, useMemo } from "react";
import { SlidersHorizontal, Camera, TrendingUp, TrendingDown, Minus, BarChart2, ArrowUp, Info } from "lucide-react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Bar, PieChart, Pie, Cell,
} from "recharts";
import { type SKUData, computeAdjustmentMultiplier } from "@/data/forecastData";
import AssumptionDrawer from "./AssumptionDrawer";
import { Tooltip as UITooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import InfoTooltip from "./InfoTooltip";
import clsx from "clsx";
import { toast } from "sonner";

// ── Design palette ──────────────────────────────────────────────────────────
const C = {
  BULL: "hsl(var(--ds-bull))",
  BASE: "hsl(var(--ds-base))",
  BEAR: "hsl(var(--ds-bear))",
  TEAL: "hsl(var(--ds-bull))",
  AMBER: "hsl(var(--ds-warning))",
  RED: "hsl(var(--destructive))",
  BLUE: "hsl(var(--ds-base))",
  PURPLE: "hsl(var(--ds-custom))",
  SLATE: "hsl(var(--ds-text-tertiary))",
  LABEL: "hsl(var(--ds-text-tertiary))",
  BODY: "hsl(var(--ds-text-secondary))",
  VALUE: "hsl(var(--ds-text-primary))",
  BORDER: "hsl(var(--border))",
  BORDER_BRIGHT: "hsl(var(--ds-border-subtle))",
  CARD: "hsl(var(--card))",
  CARD_INNER: "hsl(var(--ds-surface-muted))",
  SURFACE: "hsl(var(--secondary))",
} as const;

interface ForecastPanelProps {
  sku: SKUData;
}

const HORIZONS = [4, 8, 13, 26, 52] as const;

const SCENARIO_META: Record<string, { label: string; color: string; darkBg: string; border: string }> = {
  bull: { label: "Bull", color: C.BULL, darkBg: "hsl(var(--ds-bull) / 0.12)", border: "hsl(var(--ds-bull) / 0.35)" },
  base: { label: "Base", color: C.BASE, darkBg: "hsl(var(--ds-base) / 0.12)", border: "hsl(var(--ds-base) / 0.35)" },
  bear: { label: "Bear", color: C.BEAR, darkBg: "hsl(var(--ds-bear) / 0.12)", border: "hsl(var(--ds-bear) / 0.35)" },
};

const SCENARIO_TOOLTIP: Record<string, string> = {
  bull: "Upside scenario — assumes strong PMI, tight freight, and accelerating backlogs. Plan for higher inventory buffers and pre-position safety stock to capture demand.",
  base: "Most-likely trajectory based on current signal trends. Used as the default for replenishment planning, budget allocation, and standard ops targets.",
  bear: "Downside scenario — assumes macro deterioration, rising cancellations, and FX headwinds. Use this to stress-test your inventory plan and set floor reorder levels.",
};

const SCENARIO_ICON: Record<string, React.ElementType> = {
  bull: TrendingUp,
  base: Minus,
  bear: TrendingDown,
};

const SCENARIO_STORY: Record<string, string> = {
  bull: "Strong demand expansion detected. Freight tightening and backlog growth signal an upswing. Pre-build inventory now to capture upside without a supply gap.",
  base: "Stable macro conditions with predictable demand. Current inventory plan holds. Monitor PMI and cancel rates weekly for early scenario shifts.",
  bear: "Macro headwinds and rising cancellations signal demand softening. Delay discretionary POs, protect cash flow, and reduce safety stock targets.",
};

// ── Custom dark tooltip ──────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.CARD_INNER,
      border: `1px solid ${C.BORDER_BRIGHT}`,
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 12,
      minWidth: 160,
      boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
    }}>
      <p style={{ color: C.LABEL, marginBottom: 8, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        p.value != null && (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: p.color, flexShrink: 0 }} />
            <span style={{ color: C.LABEL, fontSize: 11 }}>{p.name}</span>
            <span style={{ color: C.VALUE, fontWeight: 600, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
              {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
            </span>
          </div>
        )
      ))}
    </div>
  );
}

// ── Semi-circle Accuracy Gauge ───────────────────────────────────────────────
function AccuracyGauge({ improvementPct }: { improvementPct: number }) {
  const pct = Math.min(100, Math.max(0, improvementPct));
  const filledData = [{ value: pct }, { value: 100 - pct }];
  const trackData  = [{ value: 100 }];

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative overflow-hidden" style={{ width: 190, height: 106 }}>
        {/* Track arc */}
        <div className="absolute" style={{ top: 0, left: 0, bottom: -74 }}>
          <PieChart width={190} height={180}>
            <Pie data={trackData} cx={95} cy={150} startAngle={180} endAngle={0}
              innerRadius={56} outerRadius={82} dataKey="value" strokeWidth={0}>
              <Cell fill={C.BORDER} />
            </Pie>
          </PieChart>
        </div>
        {/* Filled arc */}
        <div className="absolute" style={{ top: 0, left: 0, bottom: -74 }}>
          <PieChart width={190} height={180}>
            <defs>
              <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={C.TEAL} />
                <stop offset="100%" stopColor={C.BLUE} />
              </linearGradient>
            </defs>
            <Pie data={filledData} cx={95} cy={150} startAngle={180} endAngle={0}
              innerRadius={58} outerRadius={80} dataKey="value" strokeWidth={0} paddingAngle={pct > 0 && pct < 100 ? 1 : 0}>
              <Cell fill="url(#gaugeGrad)" />
              <Cell fill="transparent" />
            </Pie>
          </PieChart>
        </div>
        {/* Center text */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-1">
          <div className="flex items-center gap-1 mb-0.5">
            <ArrowUp style={{ width: 12, height: 12, color: C.TEAL }} />
          </div>
          <p style={{ fontSize: 26, fontWeight: 800, color: C.VALUE, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{improvementPct}%</p>
          <p style={{ fontSize: 10, color: C.LABEL, marginTop: 2 }}>vs baseline</p>
        </div>
      </div>
    </div>
  );
}

export default function ForecastPanel({ sku }: ForecastPanelProps) {
  const [activeScenarios, setActiveScenarios] = useState<Set<string>>(new Set(["base"]));
  const [horizon, setHorizon] = useState<number>(13);
  const [showBaseline, setShowBaseline] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"bar" | "line">("bar");
  const [sliders, setSliders] = useState<null | {
    pmi: number; freightIndex: number; backlogDays: number; cancelRate: number;
  }>(null);

  const toggleScenario = (id: string) => {
    setActiveScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  };

  const customMultiplier = sliders ? computeAdjustmentMultiplier(sliders) : null;

  const chartData = useMemo(() => {
    const merged: any[] = [];
    for (const h of sku.historical) {
      merged.push({ label: h.label, week: h.week, actual: h.actual, baseline: h.baseline });
    }
    for (let w = 1; w <= horizon; w++) {
      const point: any = { label: sku.scenarios.base.forecast[w - 1]?.label, week: w };
      for (const sid of ["bull", "base", "bear"] as const) {
        const f = sku.scenarios[sid].forecast[w - 1];
        if (f) {
          point[`${sid}_demand`] = f.demand;
          point[`${sid}_lower`]  = f.lower;
          point[`${sid}_upper`]  = f.upper;
        }
      }
      if (customMultiplier != null) {
        const baseF = sku.scenarios.base.forecast[w - 1];
        if (baseF) point.custom_demand = Math.round(baseF.demand * customMultiplier);
      }
      if (showBaseline) {
        const lastBaseline = sku.historical[sku.historical.length - 1]?.baseline ?? 0;
        point.baseline = lastBaseline;
      }
      merged.push(point);
    }
    return merged;
  }, [sku, horizon, showBaseline, customMultiplier]);

  const showCustom = customMultiplier != null;
  const acc = sku.model_accuracy;
  const todayLabel = sku.historical[sku.historical.length - 1]?.label;

  const barChartData = useMemo(() => chartData.map((d) => ({
    label:    d.label,
    actual:   d.actual   ?? null,
    forecast: d.base_demand ?? null,
  })), [chartData]);

  const totalPoints = barChartData.length;
  const xInterval = Math.max(Math.floor(totalPoints / 8) - 1, 0);

  return (
    <section className="ds-section-card" style={{ padding: 24 }}>
      {/* ── Section header ── */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <p className="ds-section-title mb-1">Scenario Forecast</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.VALUE, lineHeight: 1.2 }} className="flex items-center">
            Demand Outlook
            <InfoTooltip description="Three demand trajectories based on macro signal combinations. Bull (1,520 peak): PMI > 54, freight tight. Base (1,210 peak): stable conditions. Bear (870 peak): PMI < 48, rising cancellations. The active scenario drives all procurement recommendations below." />
          </h2>
          <p style={{ fontSize: 12, color: C.LABEL, marginTop: 4 }}>Historical actuals vs scenario-weighted ML forecast</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 text-sm ds-transition"
          style={{ color: C.LABEL }}
          onMouseEnter={e => (e.currentTarget.style.color = C.VALUE)}
          onMouseLeave={e => (e.currentTarget.style.color = C.LABEL)}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Adjust assumptions
        </button>
      </div>
      <div className="ds-section-divider mt-4" />

      {/* Scenario cards */}
      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {(["bull", "base", "bear"] as const).map((id) => {
            const scenario = sku.scenarios[id];
            const meta     = SCENARIO_META[id];
            const isActive = activeScenarios.has(id);
            const ScenarioIcon = SCENARIO_ICON[id];
            return (
              <button
                key={id}
                onClick={() => toggleScenario(id)}
                className="text-left rounded-[14px] ds-transition relative"
                style={{
                  padding: "16px 18px",
                  background: isActive ? meta.darkBg : "transparent",
                  border: `1px solid ${isActive ? meta.border : C.BORDER}`,
                  borderLeft: `4px solid ${isActive ? meta.color : C.BORDER}`,
                  opacity: isActive ? 1 : 0.55,
                }}
              >
                {/* Header row: icon + label + active dot + info */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <ScenarioIcon style={{ width: 14, height: 14, color: meta.color, flexShrink: 0 }} />
                    <p style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.07em", color: meta.color }}>
                      {scenario.label}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                    )}
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          <Info style={{ width: 12, height: 12, color: C.LABEL }} />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs leading-relaxed">
                        {SCENARIO_TOOLTIP[id]}
                      </TooltipContent>
                    </UITooltip>
                  </div>
                </div>

                {/* Storytelling description */}
                <p style={{ fontSize: 12, color: C.BODY, lineHeight: 1.55 }}>{SCENARIO_STORY[id]}</p>

                {/* Key signals / assumption */}
                <div style={{
                  marginTop: 10, padding: "6px 9px",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 7,
                  borderLeft: `2px solid ${meta.color}`,
                }}>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.LABEL, marginBottom: 2 }}>
                    Key signals
                  </p>
                  <p style={{ fontSize: 11, color: C.BODY, lineHeight: 1.45 }}>{scenario.assumption}</p>
                </div>

                {/* Peak demand */}
                <p style={{ fontSize: 13, fontWeight: 600, color: C.VALUE, marginTop: 10, fontVariantNumeric: "tabular-nums" }}>
                  {scenario.peak_demand.toLocaleString()}{" "}
                  <span style={{ fontWeight: 400, color: C.LABEL, fontSize: 11 }}>{sku.unit} peak</span>
                </p>
              </button>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1">
          {HORIZONS.map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className="px-3 py-1 rounded-full text-xs font-medium ds-transition"
              style={
                horizon === h
                  ? { background: C.TEAL, color: "#080B12", border: "transparent", fontWeight: 600 }
                  : { color: C.LABEL, border: `1px solid ${C.BORDER}`, background: "transparent" }
              }
            >
              {h}W
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: C.LABEL }}>
          <input type="checkbox" checked={showBaseline} onChange={(e) => setShowBaseline(e.target.checked)} className="rounded" />
          Baseline
        </label>

        <div className="flex items-center gap-0.5 ml-auto rounded-lg p-0.5" style={{ border: `1px solid ${C.BORDER}`, background: "hsl(var(--secondary) / 0.6)" }}>
          {(["bar", "line"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ds-transition"
              style={
                viewMode === mode
                  ? { background: C.CARD_INNER, color: C.VALUE, boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }
                  : { color: C.LABEL }
              }
            >
              {mode === "bar" ? <BarChart2 className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        <button
          onClick={() => toast.info("Use Ctrl+P / Cmd+P to print/export.")}
          style={{ color: C.LABEL }}
          onMouseEnter={e => (e.currentTarget.style.color = C.VALUE)}
          onMouseLeave={e => (e.currentTarget.style.color = C.LABEL)}
        >
          <Camera className="w-4 h-4" />
        </button>
      </div>

      {/* Chart + Accuracy side-by-side */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* ── Main Chart ── */}
        <div className="xl:col-span-9 ds-card" style={{ padding: "24px 24px 16px 24px", minHeight: 340 }}>
          <ResponsiveContainer width="100%" height={300}>
            {viewMode === "bar" ? (
              <ComposedChart data={barChartData} margin={{ top: 10, right: 16, left: 0, bottom: 24 }}>
                <defs>
                  <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.TEAL} stopOpacity={0.14} />
                    <stop offset="100%" stopColor={C.TEAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.BORDER} strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: C.LABEL, fontSize: 11 }}
                  axisLine={{ stroke: C.BORDER }}
                  tickLine={false}
                  interval={xInterval}
                />
                <YAxis
                  tick={{ fill: C.LABEL, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <ReferenceLine
                  x={todayLabel}
                  stroke={C.AMBER}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{ value: "TODAY", position: "insideTopRight", fill: C.AMBER, fontSize: 10, fontWeight: 700 }}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke={C.TEAL}
                  strokeWidth={2}
                  fill="url(#tealGradient)"
                  dot={false}
                  connectNulls={false}
                  name="Historical"
                />
                <Bar
                  dataKey="forecast"
                  fill={C.BLUE}
                  fillOpacity={0.8}
                  radius={[3, 3, 0, 0]}
                  barSize={10}
                  name="Base Forecast"
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 24 }}>
                <defs>
                  {(["bull", "base", "bear"] as const).map((sid) => (
                    <linearGradient key={sid} id={`band_${sid}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={SCENARIO_META[sid].color} stopOpacity={0.10} />
                      <stop offset="100%" stopColor={SCENARIO_META[sid].color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke={C.BORDER} strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: C.LABEL, fontSize: 11 }}
                  axisLine={{ stroke: C.BORDER }}
                  tickLine={false}
                  interval={Math.max(Math.floor(chartData.length / 8) - 1, 0)}
                />
                <YAxis
                  tick={{ fill: C.LABEL, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                />
                <Tooltip content={<DarkTooltip />} cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }} />
                <ReferenceLine
                  x={todayLabel}
                  stroke={C.AMBER}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{ value: "TODAY", position: "insideTopRight", fill: C.AMBER, fontSize: 10, fontWeight: 700 }}
                />
                <Line
                  type="monotone" dataKey="actual" stroke={C.SLATE} strokeWidth={2}
                  dot={false} connectNulls={false} name="Historical"
                />
                {(["bear", "bull", "base"] as const).map((sid) => {
                  if (!activeScenarios.has(sid)) return null;
                  return (
                    <Area
                      key={`${sid}_band`}
                      type="monotone"
                      dataKey={`${sid}_upper`}
                      stroke="none"
                      fill={SCENARIO_META[sid].color}
                      fillOpacity={0.08}
                      connectNulls={false}
                    />
                  );
                })}
                {(["bear", "bull", "base"] as const).map((sid) => {
                  if (!activeScenarios.has(sid)) return null;
                  return (
                    <Line
                      key={`${sid}_line`}
                      type="monotone"
                      dataKey={`${sid}_demand`}
                      stroke={SCENARIO_META[sid].color}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls={false}
                      name={SCENARIO_META[sid].label}
                    />
                  );
                })}
                {showCustom && (
                  <Line type="monotone" dataKey="custom_demand" stroke={C.PURPLE} strokeWidth={2} strokeDasharray="6 4" dot={false} name="Custom" />
                )}
                {showBaseline && (
                  <Line type="monotone" dataKey="baseline" stroke={C.SLATE} strokeWidth={1.5} strokeDasharray="6 4" dot={false} name="Baseline" />
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>

          {/* Custom Legend */}
          <div className="flex flex-wrap gap-5 mt-2 px-1">
            {viewMode === "bar" ? (
              <>
                <div className="flex items-center gap-2" style={{ fontSize: 11, color: C.LABEL }}>
                  <span style={{ width: 12, height: 10, borderRadius: 2, background: C.TEAL, opacity: 0.9, display: "inline-block" }} />
                  Historical Actual
                </div>
                <div className="flex items-center gap-2" style={{ fontSize: 11, color: C.LABEL }}>
                  <span style={{ width: 12, height: 10, borderRadius: 2, background: C.BLUE, opacity: 0.8, display: "inline-block" }} />
                  Base Forecast
                </div>
                <div className="flex items-center gap-2 ml-auto" style={{ fontSize: 11, color: C.LABEL }}>
                  <span style={{ width: 16, height: 1, borderTop: `2px dashed ${C.AMBER}`, display: "inline-block" }} />
                  Today
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2" style={{ fontSize: 11, color: C.LABEL }}>
                  <span style={{ width: 16, height: 2, borderRadius: 1, background: C.SLATE, display: "inline-block" }} />
                  Historical
                </div>
                {(["bull", "base", "bear"] as const).map((sid) =>
                  activeScenarios.has(sid) ? (
                    <div key={sid} className="flex items-center gap-2" style={{ fontSize: 11, color: C.LABEL }}>
                      <span style={{ width: 16, height: 2, borderRadius: 1, background: SCENARIO_META[sid].color, display: "inline-block" }} />
                      {SCENARIO_META[sid].label}
                    </div>
                  ) : null
                )}
                {showCustom && (
                  <div className="flex items-center gap-2" style={{ fontSize: 11, color: C.LABEL }}>
                    <span style={{ width: 16, height: 1, borderTop: `2px dashed ${C.PURPLE}`, display: "inline-block" }} />
                    Custom
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Accuracy Gauge card ── */}
        <div className="xl:col-span-3 ds-card flex flex-col" style={{ padding: 24 }}>
          <div className="mb-4">
            <p className="ds-section-title mb-1">Model Accuracy</p>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.VALUE }} className="flex items-center gap-1.5">
              ML vs Baseline
              <InfoTooltip description="The ML ensemble (GBM + LSTM) outperforms a naive baseline forecast. MAPE 1W = 4.2% means forecasts are within ±4.2% of actuals." />
            </h3>
            <p className="text-[12px] text-ds-text-secondary truncate mt-1">
              AI consistently outperforms the legacy moving average.
            </p>
          </div>

          <div className="flex justify-center">
            <AccuracyGauge improvementPct={acc.overall_improvement_pct} />
          </div>

          {/* MAPE table */}
          <div style={{ marginTop: 16, borderTop: `1px solid ${C.BORDER}` }}>
            {/* Header row */}
            <div className="grid grid-cols-3 gap-2" style={{ padding: "10px 0 6px", borderBottom: `1px solid ${C.BORDER}` }}>
              <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: C.LABEL }}>Metric</span>
              <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: C.TEAL, textAlign: "center" }}>ML</span>
              <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: C.LABEL, textAlign: "center" }}>Baseline</span>
            </div>
            {[
              { label: "MAPE 1W", ml: `${acc.ensemble_mape_1w}%`, base: `${acc.baseline_mape_1w}%` },
              { label: "MAPE 1M", ml: `${acc.ensemble_mape_1m}%`, base: `${acc.baseline_mape_1m}%` },
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-3 gap-2" style={{ padding: "9px 0", borderBottom: `1px solid ${C.BORDER}` }}>
                <span style={{ fontSize: 11, color: C.BODY }}>{row.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.TEAL, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{row.ml}</span>
                <span style={{ fontSize: 11, color: C.LABEL, textAlign: "center", textDecoration: "line-through", fontVariantNumeric: "tabular-nums" }}>{row.base}</span>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2" style={{ padding: "9px 0" }}>
              <span style={{ fontSize: 11, color: C.BODY }}>Retrain</span>
              <span className="col-span-2" style={{ fontSize: 11, fontWeight: 600, color: C.AMBER, textAlign: "center" }}>
                {new Date(acc.next_retrain).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <AssumptionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        baseSignals={sku.scenarios.base.signals}
        sliders={sliders}
        onSlidersChange={setSliders}
      />
    </section>
  );
}
