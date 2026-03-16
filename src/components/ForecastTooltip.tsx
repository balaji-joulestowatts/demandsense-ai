interface TooltipEntry {
  name: string;
  color: string;
  value: number;
  lower?: number;
  upper?: number;
}

interface ForecastTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  activeScenarios: Set<string>;
  showBaseline: boolean;
  showCustom: boolean;
}

const SCENARIO_NAMES: Record<string, string> = {
  bull_demand: "Bull",
  base_demand: "Base",
  bear_demand: "Bear",
  custom_demand: "Custom",
  actual: "Historical",
  baseline: "Traditional",
};

export default function ForecastTooltip({ active, payload, label, activeScenarios, showBaseline, showCustom }: ForecastTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const entries: TooltipEntry[] = [];
  const dataPoint = payload[0]?.payload;
  if (!dataPoint) return null;

  // Historical
  if (dataPoint.actual != null) {
    entries.push({ name: "Historical", color: "#94a3b8", value: dataPoint.actual });
  }

  // Scenarios
  for (const sid of ["bull", "base", "bear"] as const) {
    if (!activeScenarios.has(sid)) continue;
    const key = `${sid}_demand`;
    if (dataPoint[key] != null) {
      const colors: Record<string, string> = { bull: "#16a34a", base: "#2563eb", bear: "#d97706" };
      entries.push({
        name: sid.charAt(0).toUpperCase() + sid.slice(1),
        color: colors[sid],
        value: dataPoint[key],
        lower: dataPoint[`${sid}_lower`],
        upper: dataPoint[`${sid}_upper`],
      });
    }
  }

  if (showCustom && dataPoint.custom_demand != null) {
    entries.push({ name: "Custom", color: "#7c3aed", value: dataPoint.custom_demand });
  }

  if (showBaseline && dataPoint.baseline != null) {
    entries.push({ name: "Traditional", color: "#cbd5e1", value: dataPoint.baseline });
  }

  return (
    <div className="bg-popover/90 backdrop-blur-md border rounded-lg p-3 shadow-xl" style={{ borderColor: "#e2e8f0" }}>
      <p className="text-sm font-semibold text-ds-text-primary mb-2">{label}</p>
      {entries.map((e) => {
        const band = e.lower != null && e.upper != null ? Math.round((e.upper - e.lower) / 2) : null;
        return (
          <div key={e.name} className="flex items-center gap-2 text-xs leading-relaxed">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
            <span className="text-ds-text-secondary">{e.name}</span>
            <span className="font-semibold tabular-nums text-ds-text-primary ml-auto">
              {e.value.toLocaleString()}
            </span>
            {band != null && (
              <span className="text-ds-text-tertiary">(±{band})</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
