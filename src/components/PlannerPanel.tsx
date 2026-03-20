import { useMemo } from "react";
import {
  Factory, Package, Calendar, Truck, ClipboardList, ChartColumn,
  ShieldAlert, RefreshCw, ArrowDownToLine, ReceiptText,
} from "lucide-react";
import InfoTooltip from "./InfoTooltip";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type SKUData, type Scenario } from "@/data/forecastData";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList,
  Line, Area, Pie, PieChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis, ZAxis, Tooltip,
} from "recharts";
import {
  buildPartProjection,
  computeIncomingByPart,
  computeReorderRows,
  type ReorderRow,
} from "@/lib/supplyAnalytics";
import { toast } from "sonner";
import clsx from "clsx";

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
  ROW_HOVER: "hsl(var(--foreground) / 0.04)",
  TABLE_HEAD_BG: "hsl(var(--secondary) / 0.6)",
  DANGER_BG: "hsl(var(--destructive) / 0.06)",
  WARN_BG: "hsl(var(--ds-warning) / 0.06)",
} as const;

// ── Custom dark tooltip ──────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label, extra }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.CARD_INNER,
      border: `1px solid ${C.BORDER_BRIGHT}`,
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 12,
      minWidth: 150,
      boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
    }}>
      {label && <p style={{ color: C.LABEL, marginBottom: 8, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        p.value != null && p.value !== 0 && (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: p.color || p.fill, flexShrink: 0 }} />
            <span style={{ color: C.LABEL, fontSize: 11 }}>{p.name}</span>
            <span style={{ color: C.VALUE, fontWeight: 600, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
              {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
            </span>
          </div>
        )
      ))}
      {extra}
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────
type InventoryVsRequirementRow = {
  part: string;
  netNow: number;
  inbound4w: number;
  available4w: number;
  reqW1: number;
  req4w: number;
  safety: number;
  netEnd4w: number;
};

interface PlannerPanelProps {
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "ACT NOW": { bg: "hsl(var(--destructive) / 0.12)", text: "hsl(var(--destructive))", border: "hsl(var(--destructive) / 0.35)" },
  WATCH: { bg: "hsl(var(--ds-warning) / 0.12)", text: "hsl(var(--ds-warning))", border: "hsl(var(--ds-warning) / 0.35)" },
  HOLD: { bg: "hsl(var(--secondary) / 0.7)", text: "hsl(var(--ds-text-tertiary))", border: "hsl(var(--border))" },
};

const SCENARIO_COLORS: Record<string, string> = {
  bull: C.BULL,
  base: C.BASE,
  bear: C.BEAR,
};

// ── Confidence bar ───────────────────────────────────────────────────────────
function ConfidenceBar({ value }: { value: number }) {
  const color = value > 80 ? C.TEAL : value >= 60 ? C.AMBER : C.RED;
  return (
    <div>
      <p style={{ fontSize: 11, color: C.LABEL, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>
        Alignment confidence: {value}%
      </p>
      <div style={{ height: 6, borderRadius: 999, background: C.BORDER, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", borderRadius: 999, backgroundColor: color, transition: "width 1s ease-out" }} />
      </div>
    </div>
  );
}

const SCENARIO_STORY: Record<string, string> = {
  bull: "Strong demand expansion detected. Freight tightening and backlog growth signal an upswing. Pre-build inventory now to capture upside without a supply gap.",
  base: "Stable macro conditions with predictable demand. Current inventory plan holds. Monitor PMI and cancel rates weekly for early scenario shifts.",
  bear: "Macro headwinds and rising cancellations signal demand softening. Delay discretionary POs, protect cash flow, and reduce safety stock targets.",
};

// ── Scenario card ────────────────────────────────────────────────────────────
function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const status = STATUS_STYLES[scenario.planner.action_status];
  const color = SCENARIO_COLORS[scenario.id];
  const p = scenario.planner;
  const story = SCENARIO_STORY[scenario.id];

  return (
    <div
      className="flex flex-col gap-4"
      style={{
        padding: "20px 18px",
        background: C.CARD,
        border: `1px solid ${C.BORDER}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 14,
        boxShadow: "var(--ds-shadow-card)",
        transition: "all 200ms ease",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color }}>
          {scenario.label} scenario
        </p>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 9999,
          background: status.bg, color: status.text, border: `1px solid ${status.border}`,
          textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
        }}>
          {scenario.planner.action_status}
        </span>
      </div>
      {story && (
        <p style={{ fontSize: 12, color: C.BODY, lineHeight: 1.55, marginTop: -8 }}>{story}</p>
      )}

      <div className="grid grid-cols-1 gap-3">
        {[
          { icon: Factory,  label: "Production commit",   value: `${p.production_commit.toLocaleString()} units/wk`, highlight: true },
          { icon: Package,  label: "Inventory target",    value: `${p.inventory_target_days} days cover` },
          { icon: Calendar, label: "Release PO by",       value: `Week ${p.procurement_week}` },
        ].map(({ icon: Icon, label, value, highlight }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: C.BORDER, flexShrink: 0 }}>
              <Icon className="w-4 h-4" style={{ color: C.LABEL }} />
            </span>
            <div className="flex-1">
              <p style={{ fontSize: 12, color: C.LABEL }}>{label}</p>
              <p style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: highlight ? color : C.VALUE }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      <ConfidenceBar value={p.alignment_confidence} />

      <div className="flex gap-2 mt-auto">
        {["Export decisions", "Schedule review"].map((label) => (
          <button
            key={label}
            onClick={() => toast.success(`✓ ${label}`)}
            style={{
              flex: 1, padding: "8px 0", fontSize: 11, fontWeight: 500,
              border: `1px solid ${C.BORDER}`, borderRadius: 8,
              color: C.LABEL, background: "transparent",
              transition: "all 200ms ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.BORDER; e.currentTarget.style.color = C.VALUE; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.LABEL; }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Section header helper ────────────────────────────────────────────────────
function SectionHeader({ label, title, sub, tooltip }: { label: string; title: string; sub?: string; tooltip?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: C.LABEL, marginBottom: 4 }}>{label}</p>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: C.VALUE, lineHeight: 1.3 }} className="flex items-center">
        {title}
        {tooltip && <InfoTooltip description={tooltip} />}
      </h3>
      {sub && <p style={{ fontSize: 12, color: C.LABEL, marginTop: 4 }}>{sub}</p>}
      <div style={{ height: 1, background: `linear-gradient(90deg, rgba(0,212,160,0.18), transparent 60%)`, marginTop: 12 }} />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PlannerPanel({ sku, activeScenario }: PlannerPanelProps) {
  const scenario = sku.scenarios[activeScenario];
  const supply = sku.supply;
  const horizonWeeks = 8;
  const monthWeeks = 4;

  const computed = supply
    ? computeReorderRows({
        supply,
        productionCommitPerWeek: scenario.planner.production_commit,
        procurementWeek: scenario.planner.procurement_week,
        horizonWeeks,
      })
    : null;

  const recommendedOrderChartData = useMemo(() => {
    if (!computed) return [] as Array<{ part: string; order: number }>;
    return computed.rows
      .filter((r) => r.recommendedOrder > 0)
      .slice()
      .sort((a, b) => b.recommendedOrder - a.recommendedOrder)
      .slice(0, 10)
      .map((r) => ({ part: r.partName, order: r.recommendedOrder }));
  }, [computed]);

  const incomingByPart = useMemo(() => {
    if (!supply) return [];
    return computeIncomingByPart({ supply, horizonWeeks });
  }, [supply, horizonWeeks]);

  // PO arrivals stacked by status
  const poArrivalsStacked = useMemo(() => {
    if (!supply) return [];
    const result: Record<number, { week: string; confirmed: number; in_transit: number; planned: number }> = {};
    for (let w = 1; w <= horizonWeeks; w++) result[w] = { week: `W${w}`, confirmed: 0, in_transit: 0, planned: 0 };
    for (const po of supply.open_pos) {
      if (po.eta_week < 1 || po.eta_week > horizonWeeks) continue;
      const bucket = result[po.eta_week];
      if (!bucket) continue;
      const key = po.status as "confirmed" | "in_transit" | "planned";
      if (key in bucket) (bucket[key] as number)++;
    }
    return Object.values(result);
  }, [supply, horizonWeeks]);

  const poStatusMix = useMemo(() => {
    if (!supply) return [] as Array<{ status: string; value: number }>;
    const counts = { confirmed: 0, in_transit: 0, planned: 0 } as Record<string, number>;
    for (const po of supply.open_pos) {
      if (po.eta_week < 1 || po.eta_week > horizonWeeks) continue;
      counts[po.status] = (counts[po.status] || 0) + 1;
    }
    return Object.entries(counts).map(([status, value]) => ({ status, value })).filter((x) => x.value > 0);
  }, [supply, horizonWeeks]);

  const supplyKpis = useMemo(() => {
    if (!computed || !supply) return null;
    const stockoutCount = computed.rows.filter((r) => r.stockoutWeek != null).length;
    const belowSafetyCount = computed.rows.filter((r) => r.stockoutWeek == null && r.belowSafetyWeek != null).length;
    const reorderCount = computed.rows.filter((r) => r.recommendedOrder > 0).length;
    const totalRecommendedQty = computed.rows.reduce((sum, r) => sum + (r.recommendedOrder > 0 ? r.recommendedOrder : 0), 0);
    const inboundQtyHorizon = supply.open_pos
      .filter((po) => po.eta_week >= 1 && po.eta_week <= horizonWeeks)
      .flatMap((po) => po.lines)
      .reduce((sum, l) => sum + l.qty, 0);
    const arrivingPoCount = supply.open_pos.filter((po) => po.eta_week >= 1 && po.eta_week <= horizonWeeks).length;
    const earliestStockoutWeek = computed.rows
      .map((r) => r.stockoutWeek)
      .filter((w): w is number => typeof w === "number")
      .reduce((min, w) => Math.min(min, w), Number.POSITIVE_INFINITY);
    return {
      stockoutCount, belowSafetyCount, reorderCount, totalRecommendedQty,
      inboundQtyHorizon: Math.round(inboundQtyHorizon), arrivingPoCount,
      earliestStockoutWeek: Number.isFinite(earliestStockoutWeek) ? earliestStockoutWeek : null,
    };
  }, [computed, supply, horizonWeeks]);

  const coverByPartData = useMemo(() => {
    if (!computed) return [] as Array<{ part: string; cover: number; tone: "ok" | "watch" | "act" }>;
    return computed.rows
      .filter((r) => r.coverWeeks != null)
      .slice()
      .sort((a, b) => {
        const score = (r: ReorderRow) => (r.stockoutWeek != null ? 0 : r.belowSafetyWeek != null ? 1 : 2);
        const s = score(a) - score(b);
        return s !== 0 ? s : (a.coverWeeks ?? 999) - (b.coverWeeks ?? 999);
      })
      .slice(0, 10)
      .map((r) => ({ part: r.partName, cover: r.coverWeeks ?? 0, tone: r.riskTone }));
  }, [computed]);

  const inventoryVsRequirement4w = useMemo(() => {
    if (!computed || !supply) return [] as InventoryVsRequirementRow[];
    const inboundByPart4w: Record<string, number> = {};
    for (const po of supply.open_pos) {
      if (po.eta_week < 1 || po.eta_week > monthWeeks) continue;
      for (const line of po.lines) {
        inboundByPart4w[line.part_id] = (inboundByPart4w[line.part_id] || 0) + line.qty;
      }
    }
    return computed.rows
      .slice()
      .sort((a, b) => {
        const score = (r: ReorderRow) => (r.stockoutWeek != null ? 0 : r.belowSafetyWeek != null ? 1 : 2);
        const s = score(a) - score(b);
        return s !== 0 ? s : b.requiredPerWeek - a.requiredPerWeek;
      })
      .slice(0, 7)
      .map((r) => {
        const inbound4w = inboundByPart4w[r.partId] ?? 0;
        const reqW1 = Math.round(r.requiredPerWeek);
        const req4w = Math.round(r.requiredPerWeek * monthWeeks);
        const netNow = Math.round(r.netAvailable);
        const safety = Math.round(r.safetyStock);
        const available4w = Math.round(netNow + inbound4w);
        const netEnd4w = Math.round(netNow + inbound4w - req4w);
        return { part: r.partName, netNow, inbound4w: Math.round(inbound4w), available4w, reqW1, req4w, safety, netEnd4w };
      });
  }, [computed, supply, monthWeeks]);

  const criticalPartProjection = useMemo(() => {
    if (!supply || !computed || computed.rows.length === 0) return null;
    const score = (r: ReorderRow) => {
      if (r.stockoutWeek != null) return { tier: 0, t: r.stockoutWeek };
      if (r.belowSafetyWeek != null) return { tier: 1, t: r.belowSafetyWeek };
      return { tier: 2, t: r.coverWeeks ?? Number.POSITIVE_INFINITY };
    };
    const critical = computed.rows.slice().sort((a, b) => {
      const sa = score(a), sb = score(b);
      return sa.tier !== sb.tier ? sa.tier - sb.tier : sa.t - sb.t;
    })[0];
    return {
      partId: critical.partId,
      partName: critical.partName,
      safety: critical.safetyStock,
      data: buildPartProjection({
        supply, partId: critical.partId,
        productionCommitPerWeek: scenario.planner.production_commit,
        horizonWeeks,
      }),
    };
  }, [supply, computed, scenario.planner.production_commit, horizonWeeks]);

  const leadTimeVsCover = useMemo(() => {
    if (!computed) return { act: [], watch: [], ok: [] } as Record<"act" | "watch" | "ok", Array<any>>;
    const out = { act: [], watch: [], ok: [] } as Record<"act" | "watch" | "ok", Array<any>>;
    for (const r of computed.rows) {
      if (r.coverWeeks == null) continue;
      const bubble = Math.min(5000, Math.max(0, r.recommendedOrder));
      out[r.riskTone].push({ partName: r.partName, partId: r.partId, lead: r.leadTimeWeeks, cover: r.coverWeeks, bubble, order: r.recommendedOrder });
    }
    return out;
  }, [computed]);

  // Safety threshold for cover chart (use median lead time as proxy)
  const safetyThreshold = useMemo(() => {
    if (!computed || computed.rows.length === 0) return 4;
    const leads = computed.rows.map((r) => r.leadTimeWeeks).sort((a, b) => a - b);
    return leads[Math.floor(leads.length / 2)] ?? 4;
  }, [computed]);

  // Projected inventory min for danger zone
  const minProjected = criticalPartProjection
    ? Math.min(0, ...criticalPartProjection.data.map((d: any) => d.projected ?? 0))
    : 0;

  return (
    <section className="ds-section-card" style={{ padding: 24 }}>
      {/* ── Section header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
        <div>
          <p className="ds-section-title mb-1">Planner Alignment</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.VALUE }} className="flex items-center">
            Scenario Comparison
            <InfoTooltip description="The units-per-week your production line should plan for under each scenario. ACT NOW on Bull (1,350/wk) if you want to pre-position for upside. WATCH Base (1,120/wk) is the recommended default. HOLD on Bear (880/wk) conserves inventory but risks stockouts if demand recovers." />
          </h2>
          <p style={{ fontSize: 12, color: C.LABEL, marginTop: 4 }}>
            Parts-level restock details reflect the active scenario: <span style={{ fontWeight: 600, color: C.VALUE }}>{scenario.label}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 11, padding: "4px 10px", border: `1px solid ${C.BORDER}`, borderRadius: 8, color: C.LABEL }}>Horizon: {horizonWeeks}W</span>
          <span style={{ fontSize: 11, padding: "4px 10px", border: `1px solid ${C.BORDER}`, borderRadius: 8, color: C.LABEL }}>Commit: {scenario.planner.production_commit.toLocaleString()} {sku.unit}/wk</span>
        </div>
      </div>
      <div className="ds-section-divider mt-4" />

      {/* Scenario cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {(["bull", "base", "bear"] as const).map((id) => (
          <ScenarioCard key={id} scenario={sku.scenarios[id]} />
        ))}
      </div>

      {supply && computed && supplyKpis ? (
        <div className="space-y-6">

          {/* ── KPI strip ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
            {[
              { icon: ShieldAlert,     iconColor: C.AMBER, iconBg: "hsl(var(--ds-warning) / 0.12)", label: "Below Safety", value: supplyKpis.belowSafetyCount, sub: `Parts at risk · ${horizonWeeks}w`, danger: supplyKpis.belowSafetyCount > 0, tooltip: "Count of SKUs falling below their minimum required buffer stock within the horizon." },
              { icon: RefreshCw,       iconColor: C.BLUE,  iconBg: "hsl(var(--ds-base) / 0.12)", label: "Reorders", value: supplyKpis.reorderCount, sub: "MOQ/multiple sized", danger: false, tooltip: "Total components requiring immediate purchase orders to prevent stockouts." },
              { icon: ArrowDownToLine, iconColor: C.TEAL,  iconBg: "hsl(var(--ds-bull) / 0.12)", label: "Inbound Qty", value: supplyKpis.inboundQtyHorizon.toLocaleString(), sub: `Arriving in ${horizonWeeks}w`, danger: false, tooltip: "Total confirmed units arriving from suppliers per open purchase orders." },
              { icon: ReceiptText,     iconColor: C.LABEL, iconBg: "hsl(var(--ds-text-tertiary) / 0.12)", label: "POs Arriving", value: supplyKpis.arrivingPoCount, sub: `Open POs · ${horizonWeeks}w`, danger: false, tooltip: "Number of active Purchase Orders expected to be received within the horizon." },
            ].map(({ icon: Icon, iconColor, iconBg, label, value, sub, danger, tooltip }) => (
              <div key={label} className="ds-kpi-card" style={{ borderLeft: danger ? `3px solid ${C.AMBER}` : undefined }}>
                <div className="flex items-start justify-between">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: iconBg }}>
                    <Icon className="w-4 h-4" style={{ color: iconColor }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {danger && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 9999, background: "hsl(var(--ds-warning) / 0.15)", color: C.AMBER, border: `1px solid hsl(var(--ds-warning) / 0.35)` }}>Watch</span>
                    )}
                    <InfoTooltip description={tooltip} />
                  </div>
                </div>
                <p className="ds-kpi-label">{label}</p>
                <p style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: danger ? C.AMBER : C.VALUE }}>{value}</p>
                <p className="ds-kpi-sub line-clamp-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* ── Charts grid ── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

            {/* ⑤ Weeks of Cover — Horizontal BarChart */}
            <div className="ds-card xl:col-span-8" style={{ padding: 24 }}>
              <SectionHeader label="Supply Control Tower" title="Supply Coverage Health" sub="Weeks of cover by component vs safety threshold" tooltip="Weeks of inventory cover per component vs the safety stock threshold (dashed line). Red bars are BELOW safety — Crystal Oscillator at 0.7w means less than 1 week of cover. Order immediately. Green bars above the line are safe." />
              {coverByPartData.length === 0 ? (
                <p style={{ fontSize: 13, color: C.LABEL }}>No cover data available.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={coverByPartData.length * 44 + 40}>
                    <BarChart
                      data={coverByPartData}
                      layout="vertical"
                      margin={{ top: 0, right: 56, left: 0, bottom: 16 }}
                    >
                      <CartesianGrid horizontal={false} vertical={true} stroke={C.BORDER} strokeDasharray="3 6" />
                      <XAxis
                        type="number"
                        domain={[0, 16]}
                        tick={{ fill: C.LABEL, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: "Weeks of Cover", position: "insideBottom", offset: -8, fill: C.LABEL, fontSize: 10 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="part"
                        width={148}
                        tick={{ fill: C.BODY, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: string) => v.length > 20 ? `${v.slice(0, 20)}…` : v}
                      />
                      <ReferenceLine x={safetyThreshold} stroke={C.AMBER} strokeDasharray="4 3" strokeWidth={1.5} />
                      <Tooltip content={<DarkTooltip />} cursor={{ fill: C.ROW_HOVER }} />
                      <Bar dataKey="cover" radius={[0, 6, 6, 0]} barSize={16} background={{ fill: C.BORDER, radius: [0, 6, 6, 0] } as any}>
                        <LabelList
                          dataKey="cover"
                          position="right"
                          formatter={(v: number) => `${v}w`}
                          style={{ fontSize: 11, fontWeight: 600 }}
                          content={(props: any) => {
                            const { x, y, width, value, index } = props;
                            const d = coverByPartData[index];
                            const color = !d ? C.LABEL : d.cover >= safetyThreshold + 4 ? C.TEAL : d.cover >= safetyThreshold ? C.AMBER : C.RED;
                            return (
                              <text x={(x ?? 0) + (width ?? 0) + 6} y={(y ?? 0) + 8} fill={color} fontSize={11} fontWeight={600}>
                                {value}w
                              </text>
                            );
                          }}
                        />
                        {coverByPartData.map((d, i) => (
                          <Cell key={i} fill={d.cover >= safetyThreshold + 4 ? C.TEAL : d.cover >= safetyThreshold ? C.AMBER : C.RED} fillOpacity={0.9} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex gap-5 mt-2">
                    {[{ color: C.TEAL, label: "Safe" }, { color: C.AMBER, label: "Watch" }, { color: C.RED, label: "Danger" }].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontSize: 11, color: C.LABEL }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ④ Projected Inventory Trajectory */}
            <div className="ds-card xl:col-span-12" style={{ padding: 24 }}>
              <SectionHeader
                label="Most Constrained Component"
                title="Projected Inventory Trajectory"
                sub={criticalPartProjection ? `${criticalPartProjection.partName} · ${criticalPartProjection.partId}` : undefined}
                tooltip="Week-by-week inventory projection including inbound POs. The line going below zero means a stockout in that week. The safety threshold (dashed orange) is the minimum buffer you must maintain. Inbound bars (blue) show when open POs will arrive."
              />
              {criticalPartProjection ? (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={criticalPartProjection.data} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="projGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={C.TEAL} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={C.TEAL} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.BORDER} strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: C.LABEL, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: C.LABEL, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                    />
                    <Tooltip content={<DarkTooltip />} />
                    {/* Danger zone below zero */}
                    {minProjected < 0 && (
                      <ReferenceArea y1={minProjected} y2={0} fill="hsl(var(--destructive) / 0.08)" />
                    )}
                    {/* Zero line */}
                    <ReferenceLine y={0} stroke={C.BORDER_BRIGHT} strokeWidth={1} />
                    {/* Safety stock line */}
                    <ReferenceLine
                      y={criticalPartProjection.data[0]?.safety ?? 0}
                      stroke={C.AMBER}
                      strokeDasharray="8 4"
                      strokeWidth={1.5}
                      label={{ value: "⚠ Safety", fill: C.AMBER, fontSize: 10, position: "right" }}
                    />
                    {/* Inbound bars */}
                    <Bar dataKey="inbound" fill={C.BLUE} fillOpacity={0.70} radius={[4, 4, 0, 0]} barSize={22} name="Inbound" />
                    {/* Projected area */}
                    <Area
                      type="monotone"
                      dataKey="projected"
                      stroke={C.TEAL}
                      strokeWidth={2.5}
                      fill="url(#projGradient)"
                      dot={{ r: 4, fill: C.TEAL, stroke: C.CARD, strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: C.TEAL }}
                      name="Projected"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ fontSize: 13, color: C.LABEL }}>No projection available.</p>
              )}
              <div className="flex gap-5 mt-3">
                {[
                  { color: C.BLUE, label: "Inbound per week" },
                  { color: C.TEAL, label: "Projected inventory" },
                  { color: C.AMBER, label: "Safety stock threshold", dashed: true },
                ].map(({ color, label, dashed }) => (
                  <div key={label} className="flex items-center gap-2">
                    {dashed
                      ? <span style={{ width: 16, height: 1, borderTop: `2px dashed ${color}`, display: "inline-block" }} />
                      : <span style={{ width: 12, height: 10, borderRadius: 2, backgroundColor: color, display: "inline-block" }} />
                    }
                    <span style={{ fontSize: 11, color: C.LABEL }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ⑥ Inventory vs Requirement */}
            <div className="ds-card xl:col-span-12" style={{ padding: 24 }}>
              <SectionHeader
                label="Inventory vs Requirement"
                title="Can we cover the next 4 weeks of demand?"
                sub="Available (on hand + inbound) vs what will be consumed. If amber exceeds teal, you need to act."
                tooltip="Green bars = Available (on-hand + inbound). Orange bars = Required demand over 4 weeks. When orange exceeds green, you CANNOT cover demand — place a purchase order for that component immediately."
              />
              {inventoryVsRequirement4w.length === 0 ? (
                <p style={{ fontSize: 13, color: C.LABEL }}>No inventory data available.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={inventoryVsRequirement4w}
                      margin={{ top: 10, right: 16, left: 0, bottom: 40 }}
                      barCategoryGap="28%"
                      barGap={3}
                    >
                      <CartesianGrid stroke={C.BORDER} strokeDasharray="3 6" vertical={false} />
                      <XAxis
                        dataKey="part"
                        tick={{ fill: C.LABEL, fontSize: 11 }}
                        axisLine={{ stroke: C.BORDER }}
                        tickLine={false}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={50}
                        tickMargin={8}
                        tickFormatter={(v: string) => v.length > 14 ? `${v.slice(0, 14)}…` : v}
                      />
                      <YAxis
                        tick={{ fill: C.LABEL, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={52}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const row = inventoryVsRequirement4w.find((r) => r.part === label);
                          if (!row) return null;
                          const surplus = row.available4w - row.req4w;
                          return (
                            <div style={{ background: C.CARD_INNER, border: `1px solid ${C.BORDER_BRIGHT}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, minWidth: 220, boxShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
                              <p style={{ color: C.VALUE, fontWeight: 700, marginBottom: 8 }}>{label}</p>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                <span style={{ color: C.LABEL }}>Available (4w)</span>
                                <span style={{ color: C.TEAL, fontWeight: 600 }}>{row.available4w.toLocaleString()}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ color: C.LABEL }}>Required (4w)</span>
                                <span style={{ color: C.AMBER, fontWeight: 600 }}>{row.req4w.toLocaleString()}</span>
                              </div>
                              <div style={{ borderTop: `1px solid ${C.BORDER}`, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, color: surplus >= 0 ? C.TEAL : C.RED }}>
                                <span>{surplus >= 0 ? `+${surplus.toLocaleString()} surplus` : `–${Math.abs(surplus).toLocaleString()} shortfall`}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="available4w" fill={C.TEAL} fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={36} name="Available" />
                      <Bar dataKey="req4w"       fill={C.AMBER} fillOpacity={0.80} radius={[4, 4, 0, 0]} maxBarSize={36} name="Required" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex gap-5 mt-2">
                    {[{ color: C.TEAL, label: "Available (net + inbound)" }, { color: C.AMBER, label: "Required 4-week demand" }].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span style={{ width: 12, height: 10, borderRadius: 2, backgroundColor: color, display: "inline-block" }} />
                        <span style={{ fontSize: 12, color: C.LABEL }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ⑦ Recommended Orders */}
            <div className="xl:col-span-6" style={{ background: C.CARD, border: `1px solid ${C.BORDER}`, borderRadius: 14, boxShadow: "var(--ds-shadow-card)" }}>
              <div style={{ padding: "24px 24px 16px 24px" }}>
                <SectionHeader label="Procurement Action" title="Recommended Orders" sub="Ranked by urgency · sized to MOQ" tooltip="MOQ-rounded order quantities ranked by urgency (earliest stockout first). DRAM 8Gb needs 9,500 units most urgently (Stockout W5). Total 34,400 units across 6 parts must be ordered within this week to meet the 8-week safety horizon." />
                {recommendedOrderChartData.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.LABEL }}>No recommended orders in this horizon.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={recommendedOrderChartData}
                      margin={{ top: 24, right: 16, left: 0, bottom: recommendedOrderChartData.length > 5 ? 40 : 16 }}
                    >
                      <defs>
                        <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--destructive))" />
                          <stop offset="100%" stopColor="hsl(var(--destructive) / 0.85)" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={C.BORDER} strokeDasharray="3 6" vertical={false} />
                      <XAxis
                        dataKey="part"
                        tick={{ fill: C.LABEL, fontSize: 10 }}
                        axisLine={{ stroke: C.BORDER }}
                        tickLine={false}
                        interval={0}
                        angle={recommendedOrderChartData.length > 5 ? -30 : 0}
                        textAnchor={recommendedOrderChartData.length > 5 ? "end" : "middle"}
                        height={recommendedOrderChartData.length > 5 ? 50 : 24}
                        tickFormatter={(v: string) => v.length > 12 ? `${v.slice(0, 12)}…` : v}
                      />
                      <YAxis
                        tick={{ fill: C.LABEL, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                      />
                      <Tooltip content={<DarkTooltip />} cursor={{ fill: C.ROW_HOVER }} />
                      <Bar dataKey="order" fill="url(#redGradient)" radius={[6, 6, 0, 0]} name="Order qty">
                        <LabelList
                          dataKey="order"
                          position="top"
                          formatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString()}
                          style={{ fill: C.RED, fontSize: 11, fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {/* Footer strip */}
              {supplyKpis && (
                <div style={{
                  background: C.CARD_INNER,
                  borderTop: `1px solid ${C.BORDER}`,
                  padding: "12px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderRadius: "0 0 14px 14px",
                }}>
                  <p style={{ fontSize: 12, color: C.VALUE, fontWeight: 600 }}>
                    📦 {supplyKpis.totalRecommendedQty.toLocaleString()} units total recommended
                  </p>
                  <p style={{ fontSize: 11, color: C.LABEL }}>
                    Sized to MOQ · Safety stock horizon: {horizonWeeks}W
                  </p>
                </div>
              )}
            </div>

            {/* ⑧ Risk Map Scatter */}
            <div className="ds-card xl:col-span-6" style={{ padding: 24 }}>
              <SectionHeader
                label="Risk Map"
                title="Which parts need urgent attention?"
                sub="Parts top-right need immediate action — long lead, low cover. Bubble = order qty."
                tooltip="2D scatter: X-axis = supplier lead time (weeks), Y-axis = weeks of cover. Danger Zone = low cover + long lead time. Red dots in the danger zone need IMMEDIATE orders — by the time the PO arrives, you'll already be in stockout. Bubble size represents order quantity."
              />
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 24 }}>
                  <CartesianGrid stroke={C.BORDER} strokeDasharray="3 6" />
                  <XAxis
                    dataKey="lead"
                    type="number"
                    domain={[0, 8]}
                    tick={{ fill: C.LABEL, fontSize: 10 }}
                    axisLine={{ stroke: C.BORDER }}
                    tickLine={false}
                    label={{ value: "Lead time (weeks)", position: "insideBottom", offset: -12, fill: C.LABEL, fontSize: 10 }}
                  />
                  <YAxis
                    dataKey="cover"
                    type="number"
                    domain={[0, 16]}
                    tick={{ fill: C.LABEL, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    label={{ value: "Weeks of cover", angle: -90, position: "insideLeft", offset: 10, fill: C.LABEL, fontSize: 10 }}
                  />
                  <ZAxis dataKey="bubble" range={[30, 350]} />
                  {/* Danger zone */}
                  <ReferenceArea x1={4} x2={8} y1={0} y2={4} fill="hsl(var(--destructive) / 0.08)" stroke="hsl(var(--destructive) / 0.2)" strokeDasharray="4 4" label={{ value: "DANGER ZONE", fill: C.RED, fontSize: 9 }} />
                  <ReferenceLine x={4} stroke={C.BORDER_BRIGHT} strokeWidth={1} label={{ value: "Longer lead →", fill: C.SLATE, fontSize: 10, position: "insideTopRight" }} />
                  <ReferenceLine y={4} stroke={C.BORDER_BRIGHT} strokeWidth={1} label={{ value: "↑ Low cover", fill: C.SLATE, fontSize: 10, position: "insideTopLeft" }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0]?.payload as any;
                      if (!p) return null;
                      const zone = p.cover < 4 && p.lead > 4 ? "🔴 Danger zone" : p.cover < 6 ? "🟡 Watch zone" : "🟢 Safe";
                      return (
                        <div style={{ background: C.CARD_INNER, border: `1px solid ${C.BORDER_BRIGHT}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, minWidth: 180, boxShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
                          <p style={{ color: C.VALUE, fontWeight: 700, marginBottom: 4 }}>{p.partName}</p>
                          <p style={{ color: C.LABEL, fontSize: 11, marginBottom: 8 }}>{zone}</p>
                          {[["Lead time", `${p.lead} wks`], ["Stock cover", `${p.cover} wks`], ...(p.order > 0 ? [["Order qty", p.order.toLocaleString()]] : [])].map(([k, v]) => (
                            <div key={k as string} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
                              <span style={{ color: C.LABEL }}>{k}</span>
                              <span style={{ color: C.VALUE, fontWeight: 600 }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Scatter name="Act now" data={leadTimeVsCover.act}   fill={C.RED}   fillOpacity={0.85} stroke={`${C.RED}40`} />
                  <Scatter name="Watch"   data={leadTimeVsCover.watch} fill={C.AMBER} fillOpacity={0.85} stroke={`${C.AMBER}40`} />
                  <Scatter name="OK"      data={leadTimeVsCover.ok}    fill={C.TEAL}  fillOpacity={0.70} stroke={`${C.TEAL}40`} />
                </ScatterChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3">
                {[{ color: C.RED, label: "Act now — order immediately" }, { color: C.AMBER, label: "Watch — cover thinning" }, { color: C.TEAL, label: "OK — sufficient cover" }].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: C.LABEL }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ⑨ PO Weekly Arrivals — Stacked */}
            <div className="ds-card xl:col-span-6" style={{ padding: 24 }}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <SectionHeader label="Inbound Outlook" title="PO Weekly Arrivals" tooltip="Currently open purchase orders and their expected arrival week (ETA). These inbound quantities are already factored into the Net End projections above. If ETA slips by even 1 week, reassess stockout risk for that part." />
                <div className="flex items-center gap-4 flex-shrink-0">
                  {[{ color: C.TEAL, label: "Confirmed" }, { color: C.BLUE, label: "In Transit" }, { color: C.AMBER, label: "Planned" }].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: C.LABEL }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={poArrivalsStacked} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
                    <XAxis dataKey="week" tick={{ fill: C.LABEL, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.LABEL, fontSize: 10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: C.ROW_HOVER }} />
                    <Bar dataKey="confirmed"  stackId="a" fill={C.TEAL}  barSize={28} name="Confirmed" />
                    <Bar dataKey="in_transit" stackId="a" fill={C.BLUE}  name="In Transit" />
                    <Bar dataKey="planned"    stackId="a" fill={C.AMBER} radius={[4, 4, 0, 0]} name="Planned" />
                  </BarChart>
                </ResponsiveContainer>

                {/* PO status donut */}
                {poStatusMix.length > 0 && (
                  <div className="relative" style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={poStatusMix} dataKey="value" nameKey="status" innerRadius="50%" outerRadius="75%" paddingAngle={3} strokeWidth={0}>
                          {poStatusMix.map((entry, idx) => (
                            <Cell key={idx} fill={
                              entry.status === "confirmed"  ? C.TEAL  :
                              entry.status === "in_transit" ? C.BLUE  : C.AMBER
                            } />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p style={{ fontSize: 22, fontWeight: 800, color: C.VALUE, lineHeight: 1 }}>{poStatusMix.reduce((s, x) => s + x.value, 0)}</p>
                      <p style={{ fontSize: 10, color: C.LABEL }}>POs</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── Parts restock table ── */}
          <div className="ds-card" style={{ padding: 24 }}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardList className="w-4 h-4" style={{ color: C.LABEL }} />
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: C.VALUE }} className="flex items-center">
                    Parts to restock (recommended)
                    <InfoTooltip description="Actionable restock table for the Base scenario. NET END 4W shows projected inventory after 4 weeks — negative means stockout. ORDER QTY is MOQ-adjusted. STATUS shows the week you'll stock out if you don't order today." />
                  </h3>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 9999,
                    background:
                      scenario.planner.action_status === "ACT NOW"
                        ? "hsl(var(--destructive) / 0.12)"
                        : scenario.planner.action_status === "WATCH"
                          ? "hsl(var(--ds-warning) / 0.12)"
                          : "hsl(var(--secondary) / 0.7)",
                    color:
                      scenario.planner.action_status === "ACT NOW"
                        ? C.RED
                        : scenario.planner.action_status === "WATCH"
                          ? C.AMBER
                          : C.SLATE,
                    border: `1px solid ${
                      scenario.planner.action_status === "ACT NOW"
                        ? "hsl(var(--destructive) / 0.35)"
                        : scenario.planner.action_status === "WATCH"
                          ? "hsl(var(--ds-warning) / 0.35)"
                          : "hsl(var(--border))"
                    }`,
                  }}>
                    {scenario.planner.action_status}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: C.LABEL, paddingLeft: 24 }}>
                  Order column shows MOQ-rounded qty needed to stay above safety stock through week {horizonWeeks}.
                </p>
              </div>
              <button
                onClick={() => toast.success("✓ Restock plan exported")}
                style={{ padding: "7px 14px", fontSize: 12, border: `1px solid ${C.BORDER}`, borderRadius: 8, color: C.LABEL, background: "transparent", transition: "all 200ms ease" }}
                onMouseEnter={e => { e.currentTarget.style.background = C.BORDER; e.currentTarget.style.color = C.VALUE; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.LABEL; }}
              >
                Export restock plan
              </button>
            </div>

            {!supply || !computed ? (
              <p style={{ fontSize: 13, color: C.LABEL }}>No parts/BOM data configured for this SKU.</p>
            ) : (
              <div className="overflow-auto rounded-xl" style={{ border: `1px solid ${C.BORDER}` }}>
                <Table className="border-0 rounded-none min-w-[900px]">
                  <TableHeader>
                    <TableRow style={{ background: C.TABLE_HEAD_BG }} className="hover:bg-transparent">
                      <TableHead className="w-[260px]" style={{ color: C.LABEL }}>Part</TableHead>
                      <TableHead style={{ color: C.LABEL, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Supplier · LT</TableHead>
                      <TableHead className="text-right" style={{ color: C.LABEL }}>Net now</TableHead>
                      <TableHead className="text-right" style={{ color: C.LABEL }}>Safety</TableHead>
                      <TableHead className="text-right" style={{ color: C.LABEL }}>Inbound 4w</TableHead>
                      <TableHead className="text-right" style={{ color: C.LABEL }}>Req W1</TableHead>
                      <TableHead className="text-right" style={{ color: C.LABEL }}>Req 4w</TableHead>
                      <TableHead className="text-right" style={{ color: C.LABEL }}>Net end 4w</TableHead>
                      <TableHead className="text-right" style={{ color: C.RED }}>Order qty</TableHead>
                      <TableHead style={{ color: C.LABEL }}>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {computed.rows.map((r) => {
                      const inbound4w = supply.open_pos
                        .filter((po) => po.eta_week >= 1 && po.eta_week <= monthWeeks)
                        .flatMap((po) => po.lines)
                        .filter((l) => l.part_id === r.partId)
                        .reduce((sum, l) => sum + l.qty, 0);
                      const reqW1 = Math.round(r.requiredPerWeek);
                      const req4w = Math.round(r.requiredPerWeek * monthWeeks);
                      const netEnd4w = Math.round(r.netAvailable + inbound4w - req4w);
                      const isAtRisk = r.stockoutWeek != null;
                      const isWarn = !isAtRisk && r.belowSafetyWeek != null;

                      return (
                        <TableRow
                          key={r.partId}
                          style={{
                            background: isAtRisk ? C.DANGER_BG : isWarn ? C.WARN_BG : undefined,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = C.ROW_HOVER; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isAtRisk ? C.DANGER_BG : isWarn ? C.WARN_BG : ""; }}
                        >
                          <TableCell className="py-3">
                            <div className="flex items-start gap-2">
                              <span className="mt-1 flex-shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: isAtRisk ? C.RED : isWarn ? C.AMBER : C.TEAL }} />
                              <div>
                                <p style={{ fontWeight: 600, color: C.VALUE, fontSize: 13 }} title={r.partName}>{r.partName}</p>
                                <p style={{ fontSize: 10, color: C.LABEL }}>{r.partId} · {r.qtyPerSku}/{sku.unit} · MOQ {r.moq.toLocaleString()}</p>
                                <p style={{ fontSize: 10, color: C.LABEL }}>Cover: <span style={{ fontWeight: 600, color: r.coverWeeks != null && r.coverWeeks < r.leadTimeWeeks ? C.RED : C.BODY }}>{r.coverWeeks != null ? `${r.coverWeeks}w` : "—"}</span></p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <p style={{ fontSize: 12, color: C.BODY }}>{r.supplier}</p>
                            <p style={{ fontSize: 10, color: C.LABEL }}>LT: {r.leadTimeWeeks}w</p>
                          </TableCell>
                          <TableCell className="py-3 text-right tabular-nums text-sm" style={{ color: C.VALUE }}>{Math.round(r.netAvailable).toLocaleString()}</TableCell>
                          <TableCell className="py-3 text-right tabular-nums text-sm" style={{ color: C.LABEL }}>{Math.round(r.safetyStock).toLocaleString()}</TableCell>
                          <TableCell className="py-3 text-right tabular-nums text-sm" style={{ color: C.VALUE }}>{Math.round(inbound4w).toLocaleString()}</TableCell>
                          <TableCell className="py-3 text-right tabular-nums text-sm" style={{ color: C.VALUE }}>{reqW1.toLocaleString()}</TableCell>
                          <TableCell className="py-3 text-right tabular-nums text-sm" style={{ color: C.VALUE }}>{req4w.toLocaleString()}</TableCell>
                          <TableCell className="py-3 text-right tabular-nums text-sm font-medium" style={{ color: netEnd4w < r.safetyStock ? C.RED : C.VALUE }}>
                            {netEnd4w.toLocaleString()}{netEnd4w < r.safetyStock && <span style={{ marginLeft: 4, fontSize: 10 }}>↓</span>}
                          </TableCell>
                          <TableCell className="py-3 text-right tabular-nums font-bold text-sm" style={{ color: r.recommendedOrder > 0 ? C.RED : C.LABEL }}>
                            {r.recommendedOrder > 0 ? r.recommendedOrder.toLocaleString() : "—"}
                          </TableCell>
                          <TableCell className="py-3">
                            {r.stockoutWeek != null ? (
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 9999, background: "hsl(var(--destructive) / 0.12)", color: C.RED, border: `1px solid hsl(var(--destructive) / 0.35)`, whiteSpace: "nowrap" }}>Stockout W{r.stockoutWeek}</span>
                            ) : r.belowSafetyWeek != null ? (
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 9999, background: "hsl(var(--ds-warning) / 0.12)", color: C.AMBER, border: `1px solid hsl(var(--ds-warning) / 0.35)`, whiteSpace: "nowrap" }}>Below safety W{r.belowSafetyWeek}</span>
                            ) : r.recommendedOrder > 0 ? (
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 9999, background: "hsl(var(--ds-base) / 0.12)", color: C.BLUE, border: `1px solid hsl(var(--ds-base) / 0.35)`, whiteSpace: "nowrap" }}>Reorder by W{scenario.planner.procurement_week}</span>
                            ) : (
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 9999, background: "hsl(var(--ds-bull) / 0.1)", color: C.TEAL, border: `1px solid hsl(var(--ds-bull) / 0.3)`, whiteSpace: "nowrap" }}>✓ OK</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* ── Open POs table ── */}
          <div className="ds-card" style={{ padding: 24 }}>
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-4 h-4" style={{ color: C.LABEL }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: C.VALUE }} className="flex items-center">
                Upcoming parts orders (open POs)
                <InfoTooltip description="Currently open purchase orders and their expected arrival week (ETA). These inbound quantities are already factored into the Net End projections above. If ETA slips by even 1 week, reassess stockout risk for that part." />
              </h3>
              <span style={{ fontSize: 11, padding: "3px 8px", border: `1px solid ${C.BORDER}`, borderRadius: 8, color: C.LABEL }}>ETA weeks are relative</span>
            </div>
            {supply && incomingByPart.length > 0 ? (
              <div style={{ maxHeight: 320, overflowY: "auto", borderRadius: 10, border: `1px solid ${C.BORDER}` }}>
                <Table className="border-0">
                  <TableHeader>
                    <TableRow style={{ background: C.TABLE_HEAD_BG }} className="hover:bg-transparent">
                      <TableHead style={{ color: C.LABEL }}>Part</TableHead>
                      <TableHead style={{ color: C.LABEL }}>Supplier</TableHead>
                      <TableHead className="text-right" style={{ color: C.LABEL }}>On order</TableHead>
                      <TableHead className="text-right" style={{ color: C.LABEL }}>Next ETA</TableHead>
                      <TableHead className="text-right" style={{ color: C.LABEL }}>POs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomingByPart.map((p) => (
                      <TableRow key={p.partId}
                        onMouseEnter={e => { e.currentTarget.style.background = C.ROW_HOVER; }}
                        onMouseLeave={e => { e.currentTarget.style.background = ""; }}
                      >
                        <TableCell className="py-2">
                          <p style={{ fontWeight: 600, color: C.VALUE, fontSize: 13 }}>{p.partName} <span style={{ fontSize: 11, color: C.LABEL }}>· {p.partId}</span></p>
                        </TableCell>
                        <TableCell className="py-2" style={{ color: C.BODY, fontSize: 12 }}>{p.supplier}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums" style={{ color: C.VALUE }}>{p.onOrder.toLocaleString()}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums" style={{ color: C.AMBER, fontWeight: 600 }}>{p.nextEtaWeek ? `W${p.nextEtaWeek}` : "—"}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums" style={{ color: C.BODY }}>{p.poCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: C.LABEL }}>No purchase order data configured for this SKU.</p>
            )}
          </div>

        </div>
      ) : null}
    </section>
  );
}
