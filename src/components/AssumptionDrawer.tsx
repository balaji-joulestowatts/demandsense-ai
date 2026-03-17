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

  const formatDelta = (value: number, base: number, digits: number) => {
    const delta = value - base;
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(digits)} vs base`;
  };

  const update = (key: keyof SliderValues, val: number) => {
    onSlidersChange({ ...current, [key]: val });
  };

  const multiplier = computeAdjustmentMultiplier(current);
  const pctChange = ((multiplier - 1) * 100);

  const pmiColor = current.pmi < 48 ? "#dc2626" : current.pmi <= 51 ? "#d97706" : "#059669";
  const pmiZone = current.pmi < 48 ? "Contraction" : current.pmi > 52 ? "Expansion" : "Neutral";
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
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-xs text-ds-text-secondary leading-snug">
              Use these macro + operational signals for quick what-if planning. We convert them into a single adjustment multiplier
              applied on top of the base scenario forecast (it doesn’t replace the ML model; it stress-tests assumptions).
            </p>
            <p className="text-[11px] text-ds-text-tertiary mt-1">
              Directionally: PMI ↑ lifts demand · Freight tightness ↑ adds headwind · Backlog ↑ lifts demand · Cancel rate ↑ reduces demand
            </p>
          </div>

          {/* PMI */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-ds-text-primary">Manufacturing PMI</label>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pmiColor }} />
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-ds-text-secondary">{pmiZone}</span>
                <span className="text-sm font-semibold tabular-nums text-ds-text-primary">{current.pmi.toFixed(1)}</span>
                <span className="text-xs text-ds-text-tertiary">({formatDelta(current.pmi, baseSignals.pmi, 1)})</span>
              </div>
            </div>
            <input type="range" min={44} max={58} step={0.5} value={current.pmi}
              onChange={(e) => update("pmi", parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full accent-[#7c3aed] cursor-pointer" />
            <p className="text-[11px] text-ds-text-tertiary mt-1">PMI &lt; 48 = contraction · &gt; 52 = expansion</p>
            <p className="text-xs text-ds-text-secondary mt-2 leading-snug">
              Why we use it: PMI is a fast, widely tracked leading indicator for factory activity and new orders. When it moves into
              expansion territory, demand usually strengthens a few weeks/months later; contraction is an early warning of softening.
            </p>
          </div>

          {/* Freight */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-ds-text-primary">Freight Volume Index</label>
              <span className="text-sm font-semibold tabular-nums text-ds-text-primary">
                {current.freightIndex}
                <span className="text-xs text-ds-text-tertiary ml-1">
                  ({formatDelta(current.freightIndex, baseSignals.freight_index, 0)})
                </span>
              </span>
            </div>
            <input type="range" min={85} max={130} step={1} value={current.freightIndex}
              onChange={(e) => update("freightIndex", parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full accent-[#7c3aed] cursor-pointer" />
            <p className="text-[11px] text-ds-text-tertiary mt-1">Higher index = tighter supply, cost pressure</p>
            <p className="text-xs text-ds-text-secondary mt-2 leading-snug">
              Why we use it: Freight tightness is a real-time proxy for supply-chain congestion and logistics costs.
              A higher index often reduces fulfilled demand (longer lead times) and compresses margins (cost headwind), so we treat it as a drag.
            </p>
          </div>

          {/* Backlog */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-ds-text-primary">Customer Backlog Days</label>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-ds-text-secondary">{backlogLevel}</span>
                <span className="text-sm font-semibold tabular-nums text-ds-text-primary">{current.backlogDays}</span>
                <span className="text-xs text-ds-text-tertiary">({formatDelta(current.backlogDays, baseSignals.backlog_days, 0)})</span>
              </div>
            </div>
            <input type="range" min={15} max={70} step={1} value={current.backlogDays}
              onChange={(e) => update("backlogDays", parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full accent-[#7c3aed] cursor-pointer" />
            <p className="text-[11px] text-ds-text-tertiary mt-1">Days of visible forward demand</p>
            <p className="text-xs text-ds-text-secondary mt-2 leading-snug">
              Why we use it: Backlog days approximates how many days of demand are already “in the order book”.
              Higher backlog improves short-term forecast confidence and signals stronger near-term demand; low backlog can indicate softness.
            </p>
          </div>

          {/* Cancel Rate */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-ds-text-primary">Order Cancel Rate</label>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-ds-text-secondary">{cancelLevel}</span>
                <span className="text-sm font-semibold tabular-nums text-ds-text-primary">{current.cancelRate.toFixed(1)}%</span>
                <span className="text-xs text-ds-text-tertiary">({formatDelta(current.cancelRate, baseSignals.cancel_rate, 1)})</span>
              </div>
            </div>
            <input type="range" min={0.5} max={15} step={0.5} value={current.cancelRate}
              onChange={(e) => update("cancelRate", parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full accent-[#7c3aed] cursor-pointer" />
            <p className="text-[11px] text-ds-text-tertiary mt-1">Current period cancellation rate</p>
            <p className="text-xs text-ds-text-secondary mt-2 leading-snug">
              Why we use it: Cancellation rate is one of the quickest “demand reversal” signals.
              When cancellations rise, the order book shrinks before shipments/actuals reflect it—so we treat it as a strong near-term downside risk.
            </p>
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
