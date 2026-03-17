import { Factory, Package, Calendar, Truck, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type SKUData, type Scenario, type SupplyProfile } from "@/data/forecastData";
import { toast } from "sonner";
import clsx from "clsx";

interface PlannerPanelProps {
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
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
    <div
      className={clsx(
        "pro-card-hover p-5 flex flex-col gap-4 border-l-4",
        scenario.id === "bull" ? "bg-[#f0fdf4]" : scenario.id === "bear" ? "bg-[#fffbeb]" : "bg-[#eff6ff]",
      )}
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>
            {scenario.label} scenario
          </p>
          <p className="text-xs text-ds-text-secondary mt-1 leading-snug line-clamp-2">
            {scenario.description}
          </p>
        </div>
        <span className={clsx("text-[11px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider whitespace-nowrap", status.bg, status.text, status.border)}>
          {scenario.planner.action_status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {[
          { icon: Factory, label: "Production commit", value: `${p.production_commit.toLocaleString()} units/wk`, highlight: true },
          { icon: Package, label: "Inventory target", value: `${p.inventory_target_days} days cover` },
          { icon: Calendar, label: "Release PO by", value: `Week ${p.procurement_week}` },
        ].map(({ icon: Icon, label, value, highlight }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="ds-mini-icon">
              <Icon className="w-4 h-4" />
            </span>
            <div className="flex-1">
              <p className="text-[12px] text-ds-text-secondary">{label}</p>
              <p
                className={clsx(
                  "text-sm font-semibold tabular-nums tracking-tight",
                  highlight ? "" : "text-ds-text-primary",
                )}
                style={highlight ? { color } : undefined}
              >
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
          className="flex-1 py-2 text-xs font-medium border rounded-lg text-ds-text-secondary hover:bg-muted ds-transition"
        >
          Export decisions
        </button>
        <button
          onClick={() => toast.success("✓ Review scheduled for next Monday")}
          className="flex-1 py-2 text-xs font-medium border rounded-lg text-ds-text-secondary hover:bg-muted ds-transition"
        >
          Schedule review
        </button>
      </div>
    </div>
  );
}

type ReorderRow = {
  partId: string;
  partName: string;
  supplier: string;
  uom: string;
  leadTimeWeeks: number;
  qtyPerSku: number;
  onHand: number;
  safetyStock: number;
  onOrderHorizon: number;
  requiredHorizon: number;
  projectedEnding: number;
  recommendedOrder: number;
  riskLabel: string;
  riskTone: "ok" | "watch" | "act";
};

function roundUpToMultiple(qty: number, multiple?: number): number {
  if (!multiple || multiple <= 1) return Math.ceil(qty);
  return Math.ceil(qty / multiple) * multiple;
}

function computeReorderRows({
  supply,
  productionCommitPerWeek,
  procurementWeek,
  horizonWeeks,
}: {
  supply: SupplyProfile;
  productionCommitPerWeek: number;
  procurementWeek: number;
  horizonWeeks: number;
}): { rows: ReorderRow[]; poLinesHorizonByPart: Record<string, number> } {
  const partById = new Map(supply.parts.map((p) => [p.id, p] as const));
  const bomByPart = new Map(supply.bom.map((b) => [b.part_id, b.qty_per_sku] as const));
  const invByPart = new Map(supply.inventory.map((i) => [i.part_id, i] as const));

  const poLinesHorizonByPart: Record<string, number> = {};
  for (const po of supply.open_pos) {
    if (po.eta_week > horizonWeeks) continue;
    for (const line of po.lines) {
      poLinesHorizonByPart[line.part_id] = (poLinesHorizonByPart[line.part_id] || 0) + line.qty;
    }
  }

  const rows: ReorderRow[] = supply.parts.map((part) => {
    const qtyPerSku = bomByPart.get(part.id) ?? 0;
    const inv = invByPart.get(part.id);
    const onHand = inv?.on_hand ?? 0;
    const safetyStock = inv?.safety_stock ?? 0;
    const onOrderHorizon = poLinesHorizonByPart[part.id] ?? 0;
    const requiredPerWeek = productionCommitPerWeek * qtyPerSku;
    const requiredHorizon = requiredPerWeek * horizonWeeks;

    // Week-by-week projection to find the earliest risk week.
    let projected = onHand;
    let stockoutWeek: number | null = null;
    let belowSafetyWeek: number | null = null;
    for (let w = 1; w <= horizonWeeks; w++) {
      for (const po of supply.open_pos) {
        if (po.eta_week !== w) continue;
        for (const line of po.lines) {
          if (line.part_id === part.id) projected += line.qty;
        }
      }
      projected -= requiredPerWeek;

      if (stockoutWeek === null && projected < 0) stockoutWeek = w;
      if (belowSafetyWeek === null && projected < safetyStock) belowSafetyWeek = w;
    }

    // Recommended order: cover safety stock at end of horizon.
    const projectedEnding = onHand + onOrderHorizon - requiredHorizon;
    const netVsSafety = projectedEnding - safetyStock;
    const rawOrder = Math.max(0, -netVsSafety);
    const orderAfterMoq = Math.max(rawOrder, rawOrder > 0 ? part.moq : 0);
    const recommendedOrder = roundUpToMultiple(orderAfterMoq, part.order_multiple);

    const riskLabel =
      stockoutWeek !== null
        ? `Stockout risk (W${stockoutWeek})`
        : belowSafetyWeek !== null
          ? `Below safety (W${belowSafetyWeek})`
          : recommendedOrder > 0
            ? `Reorder (release W${procurementWeek})`
            : "OK";

    const riskTone: ReorderRow["riskTone"] =
      stockoutWeek !== null || recommendedOrder > 0
        ? "act"
        : belowSafetyWeek !== null
          ? "watch"
          : "ok";

    return {
      partId: part.id,
      partName: part.name,
      supplier: part.supplier,
      uom: part.uom,
      leadTimeWeeks: part.lead_time_weeks,
      qtyPerSku,
      onHand,
      safetyStock,
      onOrderHorizon,
      requiredHorizon: Math.round(requiredHorizon),
      projectedEnding: Math.round(projectedEnding),
      recommendedOrder: Math.round(recommendedOrder),
      riskLabel,
      riskTone,
    };
  });

  // Sort: act-now items first, then watch, then ok.
  rows.sort((a, b) => {
    const toneRank = (t: ReorderRow["riskTone"]) => (t === "act" ? 0 : t === "watch" ? 1 : 2);
    const byTone = toneRank(a.riskTone) - toneRank(b.riskTone);
    if (byTone !== 0) return byTone;
    return b.recommendedOrder - a.recommendedOrder;
  });

  return { rows, poLinesHorizonByPart };
}

export default function PlannerPanel({ sku, activeScenario }: PlannerPanelProps) {
  const scenario = sku.scenarios[activeScenario];
  const supply = sku.supply;
  const horizonWeeks = 8;

  const computed = supply
    ? computeReorderRows({
        supply,
        productionCommitPerWeek: scenario.planner.production_commit,
        procurementWeek: scenario.planner.procurement_week,
        horizonWeeks,
      })
    : null;

  return (
    <section className="ds-section-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="ds-section-title">Planner alignment</p>
          <h2 className="text-lg font-medium text-ds-text-primary">Scenario comparison</h2>
          <p className="text-xs text-ds-text-secondary mt-1">
            Parts-level restock details reflect the active scenario: <span className="font-semibold">{scenario.label}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px]">
            Horizon: {horizonWeeks} weeks
          </Badge>
          <Badge variant="outline" className="text-[11px]">
            Uses commit: {scenario.planner.production_commit.toLocaleString()} {sku.unit}/wk
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["bull", "base", "bear"] as const).map((id) => (
          <ScenarioCard key={id} scenario={sku.scenarios[id]} />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="ds-card p-4 overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-ds-text-tertiary" />
              <h3 className="font-semibold text-ds-text-primary">Parts to restock (recommended)</h3>
            </div>
            <Badge variant={scenario.planner.action_status === "ACT NOW" ? "destructive" : scenario.planner.action_status === "WATCH" ? "secondary" : "outline"}>
              {scenario.planner.action_status}
            </Badge>
          </div>

          {!supply || !computed ? (
            <p className="text-sm text-ds-text-secondary">No parts/BOM data configured for this SKU in the POC.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto rounded-lg border border-border/60">
              <Table className="border-0 rounded-none">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">On order</TableHead>
                  <TableHead className="text-right">Req (8w)</TableHead>
                  <TableHead className="text-right">End (8w)</TableHead>
                  <TableHead className="text-right">Order</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {computed.rows.map((r) => (
                  <TableRow key={r.partId}>
                    <TableCell className="py-3">
                      <div>
                        <p className="font-medium text-ds-text-primary">
                          {r.partName}
                          <span className="text-xs text-ds-text-tertiary"> · {r.partId}</span>
                        </p>
                        <p className="text-xs text-ds-text-secondary">
                          LT {r.leadTimeWeeks}w · {r.qtyPerSku} / {sku.unit} · {r.uom}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-ds-text-secondary">{r.supplier}</TableCell>
                    <TableCell className="py-3 text-right tabular-nums">{Math.round(r.onHand).toLocaleString()}</TableCell>
                    <TableCell className="py-3 text-right tabular-nums">{Math.round(r.onOrderHorizon).toLocaleString()}</TableCell>
                    <TableCell className="py-3 text-right tabular-nums">{Math.round(r.requiredHorizon).toLocaleString()}</TableCell>
                    <TableCell className={clsx("py-3 text-right tabular-nums", r.projectedEnding < r.safetyStock ? "text-[#b91c1c]" : "text-ds-text-primary")}>
                      {Math.round(r.projectedEnding).toLocaleString()}
                    </TableCell>
                    <TableCell className={clsx("py-3 text-right tabular-nums font-semibold", r.recommendedOrder > 0 ? "text-[#b91c1c]" : "text-ds-text-secondary")}>
                      {r.recommendedOrder > 0 ? r.recommendedOrder.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant={r.riskTone === "act" ? "destructive" : r.riskTone === "watch" ? "secondary" : "outline"}
                        className="text-[11px]"
                      >
                        {r.riskLabel}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}

          {supply && computed ? (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-ds-text-secondary">
                Recommendation uses safety stock and rounds to MOQ/multiples.
              </p>
              <button
                onClick={() => toast.success("✓ Restock plan exported")}
                className="py-1.5 px-3 text-xs border rounded-lg text-ds-text-secondary hover:bg-muted ds-transition"
              >
                Export restock plan
              </button>
            </div>
          ) : null}
        </div>

        <div className="ds-card p-4 overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-ds-text-tertiary" />
              <h3 className="font-semibold text-ds-text-primary">Upcoming parts orders (open POs)</h3>
            </div>
            <Badge variant="outline" className="text-[11px]">ETA weeks are relative</Badge>
          </div>

          {!supply ? (
            <p className="text-sm text-ds-text-secondary">No purchase order data configured for this SKU in the POC.</p>
          ) : supply.open_pos.length === 0 ? (
            <p className="text-sm text-ds-text-secondary">No open purchase orders.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto rounded-lg border border-border/60">
              <Table className="border-0 rounded-none">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead>PO</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">ETA</TableHead>
                  <TableHead>Lines</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supply.open_pos
                  .slice()
                  .sort((a, b) => a.eta_week - b.eta_week)
                  .map((po) => (
                    <TableRow key={po.po_number}>
                      <TableCell className="py-3 font-medium">{po.po_number}</TableCell>
                      <TableCell className="py-3 text-ds-text-secondary">{po.supplier}</TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant={po.status === "in_transit" ? "secondary" : po.status === "planned" ? "outline" : "default"}
                          className="text-[11px]"
                        >
                          {po.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums">W{po.eta_week}</TableCell>
                      <TableCell className="py-3 text-xs text-ds-text-secondary leading-snug">
                        {po.lines
                          .map((l) => {
                            const part = supply.parts.find((p) => p.id === l.part_id);
                            const label = part ? part.name : l.part_id;
                            return `${label} × ${l.qty.toLocaleString()}`;
                          })
                          .join(" · ")}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
