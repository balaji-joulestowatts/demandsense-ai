import { X } from "lucide-react";
import { type ScenarioSignals, computeAdjustmentMultiplier } from "@/data/forecastData";
import clsx from "clsx";

interface SliderValues {
  pmi: number;
  freightIndex: number;
  backlogDays: number;
  cancelRate: number;
}

interface AssumptionDrawerProps {
  open: boolean;
  onClose: () => void;
  baseSignals: ScenarioSignals;
  sliders: SliderValues | null;
  onSlidersChange: (v: SliderValues | null) => void;
}

export default function AssumptionDrawer({ open, onClose, baseSignals, sliders, onSlidersChange }: AssumptionDrawerProps) {
  const current: SliderValues = sliders ?? {
    pmi: baseSignals.pmi,
    freightIndex: baseSignals.freight_index,
    backlogDays: baseSignals.backlog_days,
    cancelRate: baseSignals.cancel_rate,
  };

  const update = (key: keyof SliderValues, val: number) => {
    onSlidersChange({ ...current, [key]: val });
  };

  const multiplier = computeAdjustmentMultiplier(current);
  const pctChange = ((multiplier - 1) * 100);

  const pmiColor = current.pmi < 48 ? "#dc2626" : current.pmi <= 51 ? "#d97706" : "#059669";
  const backlogLevel = current.backlogDays < 25 ? "Low" : current.backlogDays <= 45 ? "Normal" : "High";
  const cancelLevel = current.cancelRate < 3 ? "Healthy" : current.cancelRate <= 7 ? "Elevated" : "Critical";

  return (
    <>
      {/* Overlay */}
      {open && <div className="fixed inset-0 bg-foreground/10 z-40" onClick={onClose} />}

      {/* Drawer */}
      <div
        className={clsx(
          "fixed top-0 right-0 h-full w-[400px] max-w-full bg-card z-50 flex flex-col ds-transition",
          open ? "translate-x-0" : "translate-x-full"
        )}
        style={{ boxShadow: open ? "var(--ds-shadow-drawer)" : "none", borderLeft: "1px solid hsl(var(--ds-border-subtle))" }}
      >
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold text-ds-text-primary">Scenario Assumptions</h3>
          <button onClick={onClose} className="text-ds-text-tertiary hover:text-ds-text-primary ds-transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* PMI */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-ds-text-primary">Manufacturing PMI</label>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pmiColor }} />
                <span className="text-sm font-semibold tabular-nums text-ds-text-primary">{current.pmi.toFixed(1)}</span>
              </div>
            </div>
            <input type="range" min={44} max={58} step={0.5} value={current.pmi}
              onChange={(e) => update("pmi", parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full accent-[#7c3aed] cursor-pointer" />
            <p className="text-[11px] text-ds-text-tertiary mt-1">PMI &lt; 48 = contraction · &gt; 52 = expansion</p>
          </div>

          {/* Freight */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-ds-text-primary">Freight Volume Index</label>
              <span className="text-sm font-semibold tabular-nums text-ds-text-primary">
                {current.freightIndex}
                <span className="text-xs text-ds-text-tertiary ml-1">
                  ({current.freightIndex >= baseSignals.freight_index ? "+" : ""}{current.freightIndex - baseSignals.freight_index} vs base)
                </span>
              </span>
            </div>
            <input type="range" min={85} max={130} step={1} value={current.freightIndex}
              onChange={(e) => update("freightIndex", parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full accent-[#7c3aed] cursor-pointer" />
            <p className="text-[11px] text-ds-text-tertiary mt-1">Higher index = tighter supply, cost pressure</p>
          </div>

          {/* Backlog */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-ds-text-primary">Customer Backlog Days</label>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-ds-text-secondary">{backlogLevel}</span>
                <span className="text-sm font-semibold tabular-nums text-ds-text-primary">{current.backlogDays}</span>
              </div>
            </div>
            <input type="range" min={15} max={70} step={1} value={current.backlogDays}
              onChange={(e) => update("backlogDays", parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full accent-[#7c3aed] cursor-pointer" />
            <p className="text-[11px] text-ds-text-tertiary mt-1">Days of visible forward demand</p>
          </div>

          {/* Cancel Rate */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-ds-text-primary">Order Cancel Rate</label>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-ds-text-secondary">{cancelLevel}</span>
                <span className="text-sm font-semibold tabular-nums text-ds-text-primary">{current.cancelRate.toFixed(1)}%</span>
              </div>
            </div>
            <input type="range" min={0.5} max={15} step={0.5} value={current.cancelRate}
              onChange={(e) => update("cancelRate", parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full accent-[#7c3aed] cursor-pointer" />
            <p className="text-[11px] text-ds-text-tertiary mt-1">Current period cancellation rate</p>
          </div>
        </div>

        {/* Summary */}
        <div className="p-5 border-t space-y-3">
          <p className="text-center">
            <span className="text-2xl font-bold tabular-nums tracking-display" style={{ color: pctChange >= 0 ? "#059669" : "#dc2626" }}>
              {pctChange >= 0 ? "+" : ""}{pctChange.toFixed(1)}%
            </span>
            <span className="block text-xs text-ds-text-secondary mt-1">Estimated demand adjustment vs base</span>
          </p>
          <button
            onClick={() => onSlidersChange(null)}
            className="w-full py-2 text-sm text-ds-text-secondary border rounded-lg hover:bg-muted ds-transition"
          >
            Reset to model defaults
          </button>
        </div>
      </div>
    </>
  );
}
