import { Factory, Package, Calendar } from "lucide-react";
import { type SKUData, type Scenario } from "@/data/forecastData";
import { toast } from "sonner";
import clsx from "clsx";

interface PlannerPanelProps {
  sku: SKUData;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "ACT NOW": { bg: "bg-[#fef2f2]", text: "text-[#b91c1c]", border: "border-[#fecaca]" },
  WATCH: { bg: "bg-[#fffbeb]", text: "text-[#b45309]", border: "border-[#fde68a]" },
  HOLD: { bg: "bg-[#f0fdf4]", text: "text-[#15803d]", border: "border-[#bbf7d0]" },
};

const SCENARIO_COLORS: Record<string, string> = {
  bull: "#16a34a",
  base: "#2563eb",
  bear: "#d97706",
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value > 80 ? "#059669" : value >= 60 ? "#d97706" : "#dc2626";
  return (
    <div>
      <p className="text-xs text-ds-text-secondary mb-1 tabular-nums">
        Alignment confidence: {value}%
      </p>
      <div className="h-1.5 rounded-full bg-[#f1f5f9] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: color, transition: "width 1s ease-out" }}
        />
      </div>
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const status = STATUS_STYLES[scenario.planner.action_status];
  const color = SCENARIO_COLORS[scenario.id];
  const p = scenario.planner;

  return (
    <div className="ds-card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <h3 className="font-bold" style={{ color }}>{scenario.label} Scenario</h3>
        <span className={clsx("text-[11px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider", status.bg, status.text, status.border)}>
          {scenario.planner.action_status}
        </span>
      </div>

      <div className="space-y-3">
        {[
          { icon: Factory, label: "Production commit", value: `${p.production_commit.toLocaleString()} units/wk`, highlight: true },
          { icon: Package, label: "Inventory target", value: `${p.inventory_target_days} days cover` },
          { icon: Calendar, label: "Release PO by", value: `Week ${p.procurement_week}` },
        ].map(({ icon: Icon, label, value, highlight }) => (
          <div key={label} className="flex items-center gap-3">
            <Icon className="w-4 h-4 text-ds-text-tertiary flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[13px] text-ds-text-secondary">{label}</p>
              <p className={clsx("text-sm font-medium tabular-nums", highlight ? "" : "text-ds-text-primary")}
                style={highlight ? { color } : undefined}>
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <ConfidenceBar value={p.alignment_confidence} />

      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => toast.success("✓ Exported to planning system")}
          className="flex-1 py-1.5 text-xs border rounded-lg text-ds-text-secondary hover:bg-muted ds-transition"
        >
          Export decisions
        </button>
        <button
          onClick={() => toast.success("✓ Review scheduled for next Monday")}
          className="flex-1 py-1.5 text-xs border rounded-lg text-ds-text-secondary hover:bg-muted ds-transition"
        >
          Schedule review
        </button>
      </div>
    </div>
  );
}

export default function PlannerPanel({ sku }: PlannerPanelProps) {
  return (
    <section className="ds-section-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="ds-section-title">Planner alignment</p>
          <h2 className="text-lg font-medium text-ds-text-primary">
            Scenario comparison
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["bull", "base", "bear"] as const).map((id) => (
          <ScenarioCard key={id} scenario={sku.scenarios[id]} />
        ))}
      </div>
    </section>
  );
}
