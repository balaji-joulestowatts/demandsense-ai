import { useState, useMemo } from "react";
import { SlidersHorizontal, Camera } from "lucide-react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { type SKUData, computeAdjustmentMultiplier } from "@/data/forecastData";
import ForecastTooltip from "./ForecastTooltip";
import AssumptionDrawer from "./AssumptionDrawer";
import clsx from "clsx";
import { toast } from "sonner";

interface ForecastPanelProps {
  sku: SKUData;
}

const HORIZONS = [4, 8, 13, 26, 52] as const;
const SCENARIO_META: Record<string, { label: string; color: string; bgClass: string }> = {
  bull: { label: "Bull", color: "#16a34a", bgClass: "bg-[#f0fdf4]" },
  base: { label: "Base", color: "#2563eb", bgClass: "bg-[#eff6ff]" },
  bear: { label: "Bear", color: "#d97706", bgClass: "bg-[#fffbeb]" },
};

export default function ForecastPanel({ sku }: ForecastPanelProps) {
  const [activeScenarios, setActiveScenarios] = useState<Set<string>>(new Set(["base"]));
  const [horizon, setHorizon] = useState<number>(13);
  const [showBaseline, setShowBaseline] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sliders, setSliders] = useState<null | { pmi: number; freightIndex: number; backlogDays: number; cancelRate: number }>(null);

  const toggleScenario = (id: string) => {
    setActiveScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const customMultiplier = sliders ? computeAdjustmentMultiplier(sliders) : null;

  const chartData = useMemo(() => {
    const merged: any[] = [];
    // Historical
    for (const h of sku.historical) {
      const point: any = { label: h.label, week: h.week, actual: h.actual, baseline: h.baseline };
      merged.push(point);
    }
    // Forecast
    for (let w = 1; w <= horizon; w++) {
      const point: any = { label: sku.scenarios.base.forecast[w - 1]?.label, week: w };
      for (const sid of ["bull", "base", "bear"] as const) {
        const f = sku.scenarios[sid].forecast[w - 1];
        if (f) {
          point[`${sid}_demand`] = f.demand;
          point[`${sid}_lower`] = f.lower;
          point[`${sid}_upper`] = f.upper;
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
  }, [sku, horizon, activeScenarios, showBaseline, customMultiplier]);

  const showCustom = customMultiplier != null;

  return (
    <section className="ds-section-card p-4">
      {/* Scenario cards + adjust button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-ds-text-primary">Scenario Forecast</h2>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 text-sm text-ds-text-secondary hover:text-ds-text-primary ds-transition"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Adjust assumptions
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {(["bull", "base", "bear"] as const).map((id) => {
          const scenario = sku.scenarios[id];
          const meta = SCENARIO_META[id];
          const isActive = activeScenarios.has(id);
          return (
            <button
              key={id}
              onClick={() => toggleScenario(id)}
              className={clsx(
                "text-left p-4 rounded-xl border-l-4 ds-transition relative pro-card-hover",
                isActive
                  ? `${meta.bgClass} ring-1 ring-offset-0 -translate-y-px`
                  : "bg-white/65 opacity-80"
              )}
              style={{ borderLeftColor: isActive ? meta.color : "#cbd5e1", boxShadow: isActive ? `0 16px 26px -20px ${meta.color}66` : undefined }}
            >
              {isActive && (
                <span
                  className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
              )}
              <p className="font-semibold text-sm tracking-wide uppercase" style={{ color: meta.color }}>{scenario.label}</p>
              <p className="text-[13px] text-ds-text-secondary mt-1 leading-snug">{scenario.description}</p>
              <p className="text-[11px] text-ds-text-tertiary mt-1">{scenario.assumption}</p>
              <p className="text-sm font-medium text-ds-text-primary mt-2 tabular-nums">
                {scenario.peak_demand.toLocaleString()} {sku.unit} peak
              </p>
            </button>
          );
        })}
      </div>

      {/* Horizon + baseline toggle */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1">
          {HORIZONS.map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={clsx(
                "px-3 py-1 rounded-full text-xs font-medium ds-transition border",
                horizon === h
                  ? "bg-ds-base text-primary-foreground border-transparent"
                  : "text-ds-text-secondary border-[#e2e8f0] hover:border-[#cbd5e1]"
              )}
            >
              {h}W
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-ds-text-secondary cursor-pointer">
          <input type="checkbox" checked={showBaseline} onChange={(e) => setShowBaseline(e.target.checked)} className="rounded" />
          Show traditional forecast baseline
        </label>
        <button
          onClick={() => toast.info("Screenshot mode: Use your browser's print function (Cmd+P / Ctrl+P) for a clean export.")}
          className="ml-auto text-ds-text-tertiary hover:text-ds-text-secondary ds-transition"
        >
          <Camera className="w-4 h-4" />
        </button>
      </div>

      {/* Chart */}
      <div className="ds-card p-4 animate-pulse-subtle border border-blue-100/70">
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={Math.max(Math.floor(chartData.length / 10), 1)}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => v.toLocaleString()}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={
                <ForecastTooltip
                  activeScenarios={activeScenarios}
                  showBaseline={showBaseline}
                  showCustom={showCustom}
                />
              }
            />

            {/* Historical line */}
            <Line type="monotone" dataKey="actual" stroke="#94a3b8" strokeWidth={2} dot={false} connectNulls={false} />

            {/* Today reference line */}
            <ReferenceLine
              x={sku.historical[sku.historical.length - 1]?.label}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{
                value: "TODAY",
                position: "top",
                fill: "#94a3b8",
                fontSize: 10,
                fontWeight: 700,
              }}
            />

            {/* Confidence bands + forecast lines */}
            {(["bear", "bull", "base"] as const).map((sid) => {
              if (!activeScenarios.has(sid)) return null;
              const color = SCENARIO_META[sid].color;
              return (
                <Area
                  key={`${sid}_band`}
                  type="monotone"
                  dataKey={`${sid}_upper`}
                  stroke="none"
                  fill={color}
                  fillOpacity={0.08}
                  baseLine={chartData.map((d: any) => d[`${sid}_lower`] ?? 0)}
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
                />
              );
            })}

            {/* Custom scenario line */}
            {showCustom && (
              <Line
                type="monotone"
                dataKey="custom_demand"
                stroke="#7c3aed"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls={false}
              />
            )}

            {/* Baseline */}
            {showBaseline && (
              <Line
                type="monotone"
                dataKey="baseline"
                stroke="#cbd5e1"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={false}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3 px-2">
          <div className="flex items-center gap-1.5 text-xs text-ds-text-secondary">
            <span className="w-4 h-0.5 rounded-full" style={{ backgroundColor: "#94a3b8" }} />
            Historical
          </div>
          {(["bull", "base", "bear"] as const).map((sid) =>
            activeScenarios.has(sid) ? (
              <div key={sid} className="flex items-center gap-1.5 text-xs text-ds-text-secondary">
                <span className="w-4 h-0.5 rounded-full" style={{ backgroundColor: SCENARIO_META[sid].color }} />
                {SCENARIO_META[sid].label}
              </div>
            ) : null
          )}
          {showCustom && (
            <div className="flex items-center gap-1.5 text-xs text-ds-text-secondary">
              <span className="w-4 h-0.5 rounded-full border-t-2 border-dashed" style={{ borderColor: "#7c3aed" }} />
              Custom
            </div>
          )}
          {showBaseline && (
            <div className="flex items-center gap-1.5 text-xs text-ds-text-secondary">
              <span className="w-4 h-0.5 rounded-full border-t border-dashed" style={{ borderColor: "#cbd5e1" }} />
              Traditional
            </div>
          )}
        </div>
      </div>

      {/* Assumption drawer */}
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
