import { useMemo } from "react";
import { AlertTriangle, Bot, FileText, LineChart, ListChecks, Package, TrendingDown, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type SKUData } from "@/data/forecastData";
import { computeReorderRows } from "@/lib/supplyAnalytics";
import type { AIAdvisorHandle } from "@/components/AIAdvisor";
import clsx from "clsx";

export default function AgentBriefing({
  sku,
  activeScenario,
  advisorRef,
}: {
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
  advisorRef: React.RefObject<AIAdvisorHandle | null>;
}) {
  const scenario = sku.scenarios[activeScenario];
  const supply = sku.supply;
  const horizonWeeks = 8;
  const monthWeeks = 4;

  const computed = useMemo(() => {
    if (!supply) return null;
    return computeReorderRows({
      supply,
      productionCommitPerWeek: scenario.planner.production_commit,
      procurementWeek: scenario.planner.procurement_week,
      horizonWeeks,
    });
  }, [supply, scenario.planner.production_commit, scenario.planner.procurement_week, horizonWeeks]);

  const supplySummary = useMemo(() => {
    if (!supply || !computed) return null;
    const rows = computed.rows;

    const stockoutParts = rows.filter((r) => r.stockoutWeek != null).length;
    const belowSafetyParts = rows.filter((r) => r.stockoutWeek == null && r.belowSafetyWeek != null).length;
    const reorderParts = rows.filter((r) => r.recommendedOrder > 0).length;
    const totalRecommended = Math.round(rows.reduce((sum, r) => sum + (r.recommendedOrder > 0 ? r.recommendedOrder : 0), 0));

    const totalOnHand = Math.round(rows.reduce((sum, r) => sum + r.onHand, 0));
    const totalAllocated = Math.round(rows.reduce((sum, r) => sum + r.allocated, 0));
    const totalNetNow = Math.round(rows.reduce((sum, r) => sum + r.netAvailable, 0));
    const totalSafety = Math.round(rows.reduce((sum, r) => sum + r.safetyStock, 0));
    const requiredW1 = Math.round(rows.reduce((sum, r) => sum + r.requiredPerWeek, 0));
    const required4w = Math.round(requiredW1 * monthWeeks);

    const inboundW1 = Math.round(
      supply.open_pos
        .filter((po) => po.eta_week === 1)
        .flatMap((po) => po.lines)
        .reduce((sum, l) => sum + l.qty, 0)
    );

    const inbound4w = Math.round(
      supply.open_pos
        .filter((po) => po.eta_week >= 1 && po.eta_week <= monthWeeks)
        .flatMap((po) => po.lines)
        .reduce((sum, l) => sum + l.qty, 0)
    );

    const netEnd4w = Math.round(totalNetNow + inbound4w - required4w);
    const netVsSafety4w = Math.round(netEnd4w - totalSafety);

    const earliestStockoutWeek = rows
      .map((r) => r.stockoutWeek)
      .filter((w): w is number => typeof w === "number")
      .reduce((min, w) => Math.min(min, w), Number.POSITIVE_INFINITY);

    return {
      stockoutParts,
      belowSafetyParts,
      reorderParts,
      totalRecommended,
      totalOnHand,
      totalAllocated,
      totalNetNow,
      totalSafety,
      requiredW1,
      required4w,
      inboundW1,
      inbound4w,
      netEnd4w,
      netVsSafety4w,
      earliestStockoutWeek: Number.isFinite(earliestStockoutWeek) ? earliestStockoutWeek : null,
      act: rows.filter((r) => r.riskTone === "act").slice(0, 3),
      watch: rows.filter((r) => r.riskTone === "watch").slice(0, 4),
    };
  }, [computed, supply, monthWeeks]);

  const ask = (prompt: string) => {
    advisorRef.current?.send(prompt);
  };

  const open = () => {
    advisorRef.current?.open();
  };

  return (
    <section className="ds-section-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase font-semibold tracking-widest text-muted-foreground mb-0.5">Control tower</p>
          <h2 className="text-lg font-bold text-foreground">Inventory & Supply Briefing</h2>
          <p className="text-xs text-ds-text-secondary mt-1">
            A scenario-aware view for <span className="font-semibold">{scenario.label}</span> combining net inventory, inbound POs, and BOM requirements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px]">Horizon: {horizonWeeks}w</Badge>
          <Badge variant="outline" className="text-[11px]">Commit: {scenario.planner.production_commit.toLocaleString()} {sku.unit}/wk</Badge>
        </div>
      </div>

      {!supplySummary ? (
        <div className="ds-card p-6">
          <p className="text-sm text-ds-text-secondary">No supply/BOM data configured for this SKU.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
            {[
              {
                icon: Package,
                label: "Current net stock",
                value: supplySummary.totalNetNow.toLocaleString(),
                sub: `On hand ${supplySummary.totalOnHand.toLocaleString()} · Alloc ${supplySummary.totalAllocated.toLocaleString()}`,
              },
              {
                icon: TrendingDown,
                label: "Required (this week)",
                value: supplySummary.requiredW1.toLocaleString(),
                sub: `${scenario.planner.production_commit.toLocaleString()} ${sku.unit}/wk × BOM`,
              },
              {
                icon: TrendingDown,
                label: "Required (this month)",
                value: supplySummary.required4w.toLocaleString(),
                sub: `${monthWeeks} weeks consumption`,
              },
              { icon: Truck, label: "Inbound next week", value: supplySummary.inboundW1.toLocaleString(), sub: "From open POs (W1)" },
              { icon: Truck, label: "Inbound next 4 weeks", value: supplySummary.inbound4w.toLocaleString(), sub: "From open POs (W1–W4)" },
              {
                icon: AlertTriangle,
                label: "Net end of month",
                value: supplySummary.netEnd4w.toLocaleString(),
                sub: `Vs safety ${supplySummary.netVsSafety4w >= 0 ? "+" : ""}${supplySummary.netVsSafety4w.toLocaleString()}`,
                tone: supplySummary.netVsSafety4w < 0 ? "bad" : "ok",
              },
              {
                icon: ListChecks,
                label: "Stockout risks",
                value: supplySummary.stockoutParts.toLocaleString(),
                sub: `Earliest ${supplySummary.earliestStockoutWeek ? `W${supplySummary.earliestStockoutWeek}` : "—"}`,
              },
            ].map(({ icon: Icon, label, value, sub, tone }) => (
              <div key={label} className="ds-kpi-card border border-border/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="ds-mini-icon">
                    <Icon className="w-4 h-4" />
                  </div>
                  {tone ? (
                    <Badge variant={tone === "bad" ? "destructive" : "secondary"} className="text-[11px]">
                      {tone === "bad" ? "At risk" : "OK"}
                    </Badge>
                  ) : null}
                </div>
                <p className="ds-kpi-label mt-3 mb-1">{label}</p>
                <p className={clsx("text-2xl font-bold tabular-nums tracking-tight", tone === "bad" && "text-destructive")}>{value}</p>
                <p className="ds-kpi-sub mt-2">{sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="ds-card p-6 xl:col-span-7">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-ds-text-tertiary" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-ds-text-tertiary">Priority list</p>
                    <h3 className="font-semibold text-ds-text-primary">Top parts at risk (what breaks first)</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={supplySummary.stockoutParts > 0 ? "destructive" : "secondary"} className="text-[11px]">
                    Stockouts: {supplySummary.stockoutParts}
                  </Badge>
                  <Badge variant="outline" className="text-[11px]">
                    Below safety: {supplySummary.belowSafetyParts}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs font-semibold text-ds-text-tertiary uppercase tracking-wider">Act now (top parts)</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {supplySummary.act.length === 0 ? (
                      <li className="text-ds-text-secondary">No act-now parts in this horizon.</li>
                    ) : (
                      supplySummary.act.map((r) => (
                        <li key={r.partId} className="flex flex-wrap items-start justify-between gap-2">
                          <span className="text-ds-text-primary">
                            <span className="font-medium">{r.partName}</span>
                            <span className="text-xs text-ds-text-tertiary"> · {r.partId}</span>
                            <span className="block text-xs text-ds-text-secondary mt-0.5">
                              Net now {Math.round(r.netAvailable).toLocaleString()} · Req/wk {Math.round(r.requiredPerWeek).toLocaleString()} · Safety {Math.round(r.safetyStock).toLocaleString()}
                            </span>
                          </span>
                          <span className="text-xs text-ds-text-secondary tabular-nums whitespace-nowrap">
                            Order {r.recommendedOrder ? r.recommendedOrder.toLocaleString() : "—"} · {r.riskLabel}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                  <a
                    href="#parts-restock"
                    className="mt-3 inline-flex items-center text-xs font-semibold ds-transition underline-offset-2 hover:underline"
                    style={{ color: "hsl(var(--primary))" }}
                  >
                    View all 6 parts →
                  </a>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs font-semibold text-ds-text-tertiary uppercase tracking-wider">Watchlist</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {supplySummary.watch.length === 0 ? (
                      <li className="text-ds-text-secondary">No watchlist parts in this horizon.</li>
                    ) : (
                      supplySummary.watch.map((r) => (
                        <li key={r.partId} className="flex flex-wrap items-start justify-between gap-2">
                          <span className="text-ds-text-primary">
                            <span className="font-medium">{r.partName}</span>
                            <span className="text-xs text-ds-text-tertiary"> · {r.partId}</span>
                            <span className="block text-xs text-ds-text-secondary mt-0.5">
                              Cover {r.coverWeeks == null ? "—" : `${r.coverWeeks}w`} · LT {r.leadTimeWeeks}w · Next ETA {r.nextEtaWeek ? `W${r.nextEtaWeek}` : "—"}
                            </span>
                          </span>
                          <span className="text-xs text-ds-text-secondary tabular-nums whitespace-nowrap">{r.riskLabel}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ds-text-secondary">
                  Recommended procurement qty (next {horizonWeeks}w):{" "}
                  <span className="font-semibold tabular-nums">{supplySummary.totalRecommended.toLocaleString()}</span> across{" "}
                  <span className="font-semibold tabular-nums">{supplySummary.reorderParts.toLocaleString()}</span> parts.
                </p>
                <Badge variant="outline" className="text-[11px]">Release week: W{scenario.planner.procurement_week}</Badge>
              </div>
            </div>

            <div className="ds-card p-6 xl:col-span-5">
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-4 h-4 text-ds-text-tertiary" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ds-text-tertiary">Agent</p>
                  <h3 className="font-semibold text-ds-text-primary">Actions & deep dives</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  onClick={() => ask("Summarize current stock vs weekly/monthly requirement (week + month) for the top constrained parts. Use numbers and call out the earliest stockout week.")}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm text-ds-text-secondary hover:bg-muted ds-transition"
                >
                  <span>Explain stock vs requirement</span>
                  <span className="text-[11px] text-ds-text-tertiary">AI</span>
                </button>

                <button
                  onClick={() => ask("Explain the top 5 supply risks (parts + weeks) for the next 8 weeks and recommend concrete mitigation actions. Use numbers.")}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm text-ds-text-secondary hover:bg-muted ds-transition"
                >
                  <span>Explain risks & mitigations</span>
                  <span className="text-[11px] text-ds-text-tertiary">AI</span>
                </button>

                <button
                  onClick={() => ask("Show a chart comparing Bull/Base/Bear peak demand.")}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm text-ds-text-secondary hover:bg-muted ds-transition"
                >
                  <span className="flex items-center gap-2"><LineChart className="w-4 h-4" />Scenario compare chart</span>
                  <span className="text-[11px] text-ds-text-tertiary">JSON vis</span>
                </button>

                <button
                  onClick={() => advisorRef.current?.generateReport()}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm text-ds-text-secondary hover:bg-muted ds-transition"
                >
                  <span className="flex items-center gap-2"><FileText className="w-4 h-4" />Generate executive report</span>
                  <span className="text-[11px] text-ds-text-tertiary">PDF</span>
                </button>

                <button
                  onClick={open}
                  className="w-full rounded-lg px-3 py-2.5 text-sm font-semibold ds-transition"
                  style={{
                    background: "linear-gradient(90deg, #1A7F5A 0%, #22a872 100%)",
                    color: "#fff",
                    boxShadow: "0 0 0 0 rgba(26,127,90,0)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px rgba(26,127,90,0.35)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 0 rgba(26,127,90,0)"; }}
                >
                  Open AI Advisor
                </button>
              </div>

              <p className="mt-4 text-xs text-ds-text-tertiary">
                Tip: Configure <span className="font-mono">VITE_GEMINI_API_KEY</span> to enable live responses.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
