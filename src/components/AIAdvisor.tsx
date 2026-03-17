import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, X, Trash2, Sparkles, FileText, Download, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { type SKUData } from "@/data/forecastData";
import { type AdvisorMessage, type AdvisorContext, streamAdvisor } from "@/lib/advisorApi";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { createRoot } from "react-dom/client";
import clsx from "clsx";
import { toast } from "sonner";

interface AIAdvisorProps {
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
  currentSliders?: {
    pmi: number;
    freight_index: number;
    backlog_days: number;
    cancel_rate: number;
  };
}

const SUGGESTED = [
  "How do I increase profit next month?",
  "What if PMI drops to 45?",
  "Should I increase production in the bull scenario?",
  "What's the best procurement strategy right now?",
  "How much inventory buffer do I need for the bear case?",
  "Compare my risk across all 3 scenarios",
  "What signals should I watch to switch from base to bull?",
  "PMI is at 5 — what's the damage?",
  "Generate a planning report for this scenario",
];

const SCENARIO_COLORS: Record<string, string> = {
  bull: "bg-emerald-100 text-emerald-700",
  base: "bg-blue-100 text-blue-700",
  bear: "bg-amber-100 text-amber-700",
};

// ── Visualization JSON contract (model → UI) ────────────────────────────────
type VisualizationType =
  | "demand_trend"
  | "scenario_compare"
  | "pmi_sensitivity"
  | "inventory_backlog"
  | "freight"
  | "cancel_rate";

type VisualizationPoint = {
  label: string;
  value: number;
  low?: number;
  high?: number;
};

type VisualizationResponse = {
  visualization: true;
  type: VisualizationType;
  title?: string;
  unit?: string;
  baseline?: { label?: string; value: number } | null;
  data: VisualizationPoint[];
};

function parseVisualizationResponse(content: string): VisualizationResponse | null {
  const text = content.trim();
  if (!text) return null;

  const tryParse = (candidate: string) => {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== "object") return null;

      const v = parsed as Partial<VisualizationResponse>;
      if (v.visualization !== true) return null;
      if (typeof v.type !== "string") return null;
      if (!Array.isArray(v.data)) return null;

      const validData = v.data.every(
        (p) =>
          p &&
          typeof p === "object" &&
          typeof (p as any).label === "string" &&
          typeof (p as any).value === "number" &&
          Number.isFinite((p as any).value) &&
          (((p as any).low === undefined) || (typeof (p as any).low === "number" && Number.isFinite((p as any).low))) &&
          (((p as any).high === undefined) || (typeof (p as any).high === "number" && Number.isFinite((p as any).high)))
      );
      if (!validData) return null;

      const out: VisualizationResponse = {
        visualization: true,
        type: v.type as VisualizationType,
        title: typeof v.title === "string" ? v.title : undefined,
        unit: typeof v.unit === "string" ? v.unit : undefined,
        baseline:
          v.baseline && typeof v.baseline === "object" && typeof (v.baseline as any).value === "number" && Number.isFinite((v.baseline as any).value)
            ? { label: typeof (v.baseline as any).label === "string" ? (v.baseline as any).label : undefined, value: (v.baseline as any).value }
            : (v.baseline === null ? null : undefined),
        data: v.data as VisualizationPoint[],
      };
      return out;
    } catch {
      return null;
    }
  };

  const direct = tryParse(text);
  if (direct) return direct;

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    const sliced = text.slice(first, last + 1);
    const normalized = sliced
      .replace(/\u201c|\u201d/g, '"')
      .replace(/\u2018|\u2019/g, "'");
    return tryParse(normalized);
  }

  return null;
}

// ── Visual tag parsing ────────────────────────────────────────────────────────
type VisualType =
  | "NONE"
  | "DEMAND_TREND"
  | "SCENARIO_COMPARE"
  | "PMI_SENSITIVITY"
  | "INVENTORY"
  | "FREIGHT"
  | "CANCEL_RATE";

const VISUAL_TAG_RE = /\[VISUAL:(NONE|DEMAND_TREND|SCENARIO_COMPARE|PMI_SENSITIVITY|INVENTORY|FREIGHT|CANCEL_RATE)(?::(-?[\d.]+))?\]/;

function parseVisualTag(content: string): { type: VisualType; param: number | null } {
  const firstLine = content.trimStart().split("\n")[0].trim();
  const m = firstLine.match(VISUAL_TAG_RE);
  if (!m) return { type: "NONE", param: null };
  return {
    type: m[1] as VisualType,
    param: m[2] != null ? Number(m[2]) : null,
  };
}

/** Strip the [VISUAL:…] tag from the FIRST line before displaying */
function stripVisualTag(content: string): string {
  const lines = content.trimStart().split("\n");
  if (lines[0] && VISUAL_TAG_RE.test(lines[0].trim())) {
    // Remove first line (tag) and leading blank lines
    return lines.slice(1).join("\n").trimStart();
  }
  // Fallback: also strip from end in case model put it there
  return content.replace(/\[VISUAL:[A-Z_]+(?::-?[\d.]+)?\]\s*$/m, "").trimEnd();
}

// ── Content helpers ───────────────────────────────────────────────────────────
function cleanContent(content: string): string {
  return stripVisualTag(
    content
      .split(/\r?\n/)
      .filter((line) => {
        const t = line.trim();
        if (!t) return true;
        if (t.startsWith(":")) return false;
        if (/^data:\s*/i.test(t)) return false;
        if (/OPENROUTER\s+PROCESSING/i.test(t)) return false;
        return true;
      })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function stripScenarioTable(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (/^\|/.test(t)) return false;
      if (/^Scenario peak snapshot$/i.test(t)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactContent(content: string): string {
  const text = stripScenarioTable(content);
  if (text.length <= 420) return text;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  let impactCount = 0;
  let actionCount = 0;

  for (const line of lines) {
    const normalized = line.replace(/^→\s*/, "");
    const isSituation = /^\*\*?Situation:?\*\*?/i.test(normalized) || /^Situation:/i.test(normalized);
    const isImpactHeader = /^\*\*?Impact:?\*\*?/i.test(normalized) || /^Impact:/i.test(normalized);
    const isActionsHeader = /^\*\*?Actions:?\*\*?/i.test(normalized) || /^Actions:/i.test(normalized);
    const isRisk = /^\*\*?Risk:?\*\*?/i.test(normalized) || /^Risk:/i.test(normalized);
    const isBullet = /^[-*]\s+/.test(normalized);
    const isNumbered = /^\d+\.\s+/.test(normalized);

    if (isSituation || isImpactHeader || isActionsHeader || isRisk) { out.push(normalized); continue; }
    if (isBullet && impactCount < 3) { out.push(normalized); impactCount++; continue; }
    if (isNumbered && actionCount < 3) { out.push(normalized); actionCount++; continue; }
  }

  if (out.length === 0) return lines.slice(0, 8).join("\n");
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

type StructuredImpact = { label?: string; value?: string; detail?: string };
type StructuredAction = { step?: number; timeframe?: string; action?: string };
type StructuredVisualPoint = { label?: string; value?: number | string; low?: number | string; high?: number | string };
type StructuredVisual = {
  title?: string;
  type?: "bar_range" | "bar" | "line";
  unit?: string;
  baseline?: { label?: string; value?: number | string };
  data?: StructuredVisualPoint[];
  series?: Array<{ name?: string; color?: string; data?: StructuredVisualPoint[] }>;
};
type StructuredResponse = {
  response_type?: "analysis" | "report";
  title?: string;
  situation?: string;
  impact?: StructuredImpact[];
  actions?: StructuredAction[];
  risk?: string;
  kpis?: Record<string, string | number>;
  visual?: StructuredVisual;
  executive_summary?: string;
  kpi_snapshot?: Record<string, string | number>;
  scenario_comparison?: Array<Record<string, string | number>>;
  key_risks?: string[];
  action_plan_30_60_90?: Array<Record<string, string | number>>;
  final_recommendation?: string;
};

function parseStructuredResponse(content: string): StructuredResponse | null {
  const text = content.trim();
  if (!text) return null;

  const tryParse = (candidate: string) => {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed as StructuredResponse;
      return null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(text);
  if (direct) return direct;

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    const sliced = text.slice(first, last + 1);
    const normalized = sliced
      .replace(/\u201c|\u201d/g, '"')
      .replace(/\u2018|\u2019/g, "'");
    return tryParse(normalized);
  }
  return null;
}

function StructuredResponseView({ data }: { data: StructuredResponse }) {
  const impact = data.impact ?? [];
  const actions = data.actions ?? [];
  const kpis = data.kpis ?? data.kpi_snapshot ?? {};

  if (data.response_type === "report") {
    return (
      <div className="not-prose space-y-3">
        <h4 className="text-sm font-semibold text-[hsl(var(--ds-text-primary))]">{data.title || "Demand Planning Report"}</h4>
        {data.executive_summary && <p className="text-sm text-[hsl(var(--ds-text-secondary))]">{data.executive_summary}</p>}

        {data.visual && <LlmVisual visual={data.visual} />}

        {Object.keys(kpis).length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(kpis).slice(0, 6).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-[hsl(var(--ds-border-subtle))] bg-[hsl(var(--background))] px-2 py-1.5 text-xs">
                <div className="text-[hsl(var(--ds-text-tertiary))]">{k.replace(/_/g, " ")}</div>
                <div className="font-semibold text-[hsl(var(--ds-text-primary))]">{String(v)}</div>
              </div>
            ))}
          </div>
        )}

        {Array.isArray(data.scenario_comparison) && data.scenario_comparison.length > 0 && (
          <div className="rounded-lg border border-[hsl(var(--ds-border-subtle))] overflow-hidden">
            <div className="grid grid-cols-5 gap-2 px-2 py-1.5 text-[10px] font-semibold uppercase bg-[hsl(var(--muted))] text-[hsl(var(--ds-text-tertiary))]">
              <span>Scenario</span><span>Peak</span><span>Commit</span><span>Gap</span><span>Stance</span>
            </div>
            {data.scenario_comparison.slice(0, 3).map((row, idx) => (
              <div key={idx} className="grid grid-cols-5 gap-2 px-2 py-1.5 text-xs border-t border-[hsl(var(--ds-border-subtle))]">
                <span>{String(row.scenario ?? "-")}</span>
                <span>{String(row.peak_demand ?? "-")}</span>
                <span>{String(row.production_commit ?? "-")}</span>
                <span>{String(row.gap_vs_commit ?? "-")}</span>
                <span>{String(row.suggested_stance ?? "-")}</span>
              </div>
            ))}
          </div>
        )}

        {Array.isArray(data.key_risks) && data.key_risks.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-[hsl(var(--ds-text-primary))] mb-1">Key risks</div>
            <ul className="list-disc pl-4 text-xs text-[hsl(var(--ds-text-secondary))] space-y-0.5">
              {data.key_risks.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        {data.final_recommendation && (
          <div className="rounded-lg bg-[hsl(var(--muted))] px-2 py-2 text-xs text-[hsl(var(--ds-text-secondary))]">
            <span className="font-semibold text-[hsl(var(--ds-text-primary))]">Recommendation:</span> {data.final_recommendation}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="not-prose space-y-3">
      <h4 className="text-sm font-semibold text-[hsl(var(--ds-text-primary))]">{data.title || "Planning insight"}</h4>
      {data.situation && (
        <p className="text-sm text-[hsl(var(--ds-text-secondary))]"><span className="font-semibold text-[hsl(var(--ds-text-primary))]">Situation:</span> {data.situation}</p>
      )}

      {data.visual && <LlmVisual visual={data.visual} />}

      {impact.length > 0 && (
        <div className="space-y-1.5">
          {impact.slice(0, 4).map((it, idx) => (
            <div key={idx} className="rounded-lg border border-[hsl(var(--ds-border-subtle))] bg-[hsl(var(--background))] px-2 py-1.5 text-xs">
              <div className="font-semibold text-[hsl(var(--ds-text-primary))]">{it.label || "Metric"}: {it.value || "-"}</div>
              {it.detail && <div className="text-[hsl(var(--ds-text-secondary))]">{it.detail}</div>}
            </div>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-[hsl(var(--ds-text-primary))] mb-1">Actions</div>
          <ol className="list-decimal pl-4 text-xs text-[hsl(var(--ds-text-secondary))] space-y-0.5">
            {actions.slice(0, 4).map((a, idx) => (
              <li key={idx}><span className="font-medium">{a.timeframe || `Step ${a.step ?? idx + 1}`}</span> — {a.action || "-"}</li>
            ))}
          </ol>
        </div>
      )}

      {Object.keys(kpis).length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(kpis).slice(0, 6).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-[hsl(var(--muted))] px-2 py-1.5 text-xs">
              <div className="text-[hsl(var(--ds-text-tertiary))]">{k.replace(/_/g, " ")}</div>
              <div className="font-semibold text-[hsl(var(--ds-text-primary))]">{String(v)}</div>
            </div>
          ))}
        </div>
      )}

      {data.risk && (
        <p className="text-xs text-[hsl(var(--ds-text-secondary))]"><span className="font-semibold text-[hsl(var(--ds-text-primary))]">Risk:</span> {data.risk}</p>
      )}
    </div>
  );
}

function looksLikeReport(content: string): boolean {
  const structured = parseStructuredResponse(content);
  if (structured?.response_type === "report") return true;

  const t = content.toLowerCase();
  return (
    t.includes("executive summary") ||
    t.includes("report") ||
    t.includes("key signals") ||
    t.includes("recommendation") ||
    t.includes("scenario")
  );
}

function markdownToPlainText(markdown: string): string {
  const structured = parseStructuredResponse(markdown);
  if (structured) {
    const lines: string[] = [];
    lines.push(structured.title || (structured.response_type === "report" ? "Demand Planning Report" : "Planning Insight"));

    if (structured.situation) {
      lines.push("", `Situation: ${structured.situation}`);
    }

    if (Array.isArray(structured.impact) && structured.impact.length > 0) {
      lines.push("", "Impact:");
      for (const it of structured.impact) {
        lines.push(`- ${it.label || "Metric"}: ${it.value || "-"}${it.detail ? ` (${it.detail})` : ""}`);
      }
    }

    if (Array.isArray(structured.actions) && structured.actions.length > 0) {
      lines.push("", "Actions:");
      for (const a of structured.actions) {
        lines.push(`- ${a.timeframe || `Step ${a.step ?? ""}`}: ${a.action || "-"}`);
      }
    }

    if (structured.risk) {
      lines.push("", `Risk: ${structured.risk}`);
    }

    const kpis = structured.kpis ?? structured.kpi_snapshot;
    if (kpis && Object.keys(kpis).length > 0) {
      lines.push("", "KPIs:");
      for (const [k, v] of Object.entries(kpis)) {
        lines.push(`- ${k.replace(/_/g, " ")}: ${String(v)}`);
      }
    }

    if (Array.isArray(structured.scenario_comparison) && structured.scenario_comparison.length > 0) {
      lines.push("", "Scenario Comparison:");
      for (const row of structured.scenario_comparison) {
        lines.push(`- ${String(row.scenario ?? "-")}: Peak ${String(row.peak_demand ?? "-")}, Commit ${String(row.production_commit ?? "-")}, Gap ${String(row.gap_vs_commit ?? "-")}, Stance ${String(row.suggested_stance ?? "-")}`);
      }
    }

    if (Array.isArray(structured.key_risks) && structured.key_risks.length > 0) {
      lines.push("", "Key Risks:");
      for (const r of structured.key_risks) lines.push(`- ${r}`);
    }

    if (structured.final_recommendation) {
      lines.push("", `Final Recommendation: ${structured.final_recommendation}`);
    }

    return lines.join("\n").trim();
  }

  return markdown
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^\|/gm, "")
    .replace(/\|\s*$/gm, "")
    .replace(/\|/g, "  ")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksJsonish(content: string): boolean {
  const t = content.trimStart();
  if (!t) return false;
  if (t.startsWith("{") || t.startsWith("[")) return true;
  if (/\"response_type\"\s*:/.test(t)) return true;
  if (/\"visualization\"\s*:/.test(t)) return true;
  return false;
}

function humanizeAccidentalJson(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  const structured = parseStructuredResponse(trimmed);
  if (structured) return markdownToPlainText(trimmed);

  const vis = parseVisualizationResponse(trimmed);
  if (vis) {
    const lines: string[] = [];
    lines.push(vis.title || "Chart");
    lines.push(`Type: ${vis.type}${vis.unit ? ` (${vis.unit})` : ""}`);
    if (vis.baseline && typeof vis.baseline.value === "number") {
      lines.push(`Baseline: ${vis.baseline.label || "baseline"} ${vis.baseline.value}`);
    }
    const pts = vis.data.slice(0, 8);
    if (pts.length) {
      lines.push("", "Data:");
      for (const p of pts) {
        const range = (typeof p.low === "number" || typeof p.high === "number")
          ? ` (range ${p.low ?? "-"}–${p.high ?? "-"})`
          : "";
        lines.push(`- ${p.label}: ${p.value}${range}`);
      }
    }
    return lines.join("\n").trim();
  }

  // Best-effort extraction for partially streamed/invalid JSON
  const pick = (re: RegExp) => {
    const m = trimmed.match(re);
    return m?.[1]?.trim() || "";
  };
  const title = pick(/\"title\"\s*:\s*\"([^\"]+)\"/i);
  const situation = pick(/\"situation\"\s*:\s*\"([^\"]+)\"/i);
  const risk = pick(/\"risk\"\s*:\s*\"([^\"]+)\"/i);

  const actionMatches = Array.from(trimmed.matchAll(/\"action\"\s*:\s*\"([^\"]+)\"/gi))
    .map((m) => m[1]?.trim())
    .filter(Boolean)
    .slice(0, 4);
  const impactPairs = Array.from(trimmed.matchAll(/\"label\"\s*:\s*\"([^\"]+)\"\s*,\s*\"value\"\s*:\s*\"([^\"]+)\"/gi))
    .map((m) => ({ label: m[1]?.trim(), value: m[2]?.trim() }))
    .filter((x) => x.label && x.value)
    .slice(0, 4);

  const lines: string[] = [];
  if (title) lines.push(title);
  if (situation) lines.push("", `Situation: ${situation}`);
  if (impactPairs.length) {
    lines.push("", "Impact:");
    for (const it of impactPairs) lines.push(`- ${it.label}: ${it.value}`);
  }
  if (actionMatches.length) {
    lines.push("", "Actions:");
    for (const a of actionMatches) lines.push(`- ${a}`);
  }
  if (risk) lines.push("", `Risk: ${risk}`);

  if (lines.length) return lines.join("\n").trim();
  return "I received a malformed formatted response. Please retry your question.";
}

async function downloadPdfReport({
  fileName,
  title,
  content,
  sku,
  activeScenario,
  visualization,
}: {
  fileName: string;
  title: string;
  content: string;
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
  visualization: VisualizationResponse | null;
}) {
  const [{ jsPDF }, html2canvas] = await Promise.all([
    import("jspdf"),
    import("html2canvas").then((m) => m.default),
  ]);

  // Render a styled report offscreen, screenshot it, then slice into A4 pages.
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "794px"; // ~A4 width at 96dpi
  container.style.background = "#ffffff";
  container.style.color = "#0f172a";
  container.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    <ReportPdfView
      title={title}
      sku={sku}
      activeScenario={activeScenario}
      assistantContent={content}
      visualization={visualization}
    />
  );

  // Wait for layout / charts
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 50));

  const canvas = await html2canvas(container, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/png");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let offsetY = 0;
  while (offsetY < imgHeight - 1) {
    doc.addImage(imgData, "PNG", 0, -offsetY, imgWidth, imgHeight);
    offsetY += pageHeight;
    if (offsetY < imgHeight - 1) doc.addPage();
  }

  doc.save(fileName);

  root.unmount();
  container.remove();
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, background: "#f8fafc" }}>
      <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function VisualizationChartStatic({ vis, height = 160 }: { vis: VisualizationResponse; height?: number }) {
  const hasRange = vis.data.some((p) => typeof p.low === "number" || typeof p.high === "number");
  const baselineVal = vis.baseline?.value;
  const data = vis.data.map((p) => ({ label: p.label, value: p.value, low: p.low, high: p.high }));

  const chartConfig = {
    value: { label: "Value", color: "#2563eb" },
    low: { label: "Low", color: "#94a3b8" },
    high: { label: "High", color: "#94a3b8" },
  } as const;

  const isTrend = vis.type === "demand_trend";

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#ffffff" }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>{vis.title || "Chart"}</div>
      <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
        {isTrend ? (
          <LineChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            {typeof baselineVal === "number" && Number.isFinite(baselineVal) && (
              <ReferenceLine y={baselineVal} stroke="#2563eb" strokeDasharray="4 3" />
            )}
            {hasRange && (
              <>
                <Line type="monotone" dataKey="low" stroke="var(--color-low)" strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="high" stroke="var(--color-high)" strokeDasharray="4 4" dot={false} />
              </>
            )}
            <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={false} />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            {typeof baselineVal === "number" && Number.isFinite(baselineVal) && (
              <ReferenceLine y={baselineVal} stroke="#2563eb" strokeDasharray="4 3" />
            )}
            <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} />
          </BarChart>
        )}
      </ChartContainer>
    </div>
  );
}

function buildDefaultVisuals(sku: SKUData, activeScenario: "bull" | "base" | "bear"): VisualizationResponse[] {
  const scenario = sku.scenarios[activeScenario];
  const basePmi = scenario.signals.pmi;
  const pmiTarget = basePmi - 5;
  const deltaPct = (pmiTarget - basePmi) * 0.8;
  const baseW1 = scenario.forecast[0]?.demand ?? 0;
  const projW1 = Math.max(0, Math.round(baseW1 * (1 + deltaPct / 100)));

  const demandTrend: VisualizationResponse = {
    visualization: true,
    type: "demand_trend",
    title: "Weekly Demand Forecast (W1–W8)",
    unit: "units/wk",
    baseline: { label: "commit", value: scenario.planner.production_commit },
    data: scenario.forecast.slice(0, 8).map((w, i) => ({
      label: `W${i + 1}`,
      value: w.demand,
      low: w.lower,
      high: w.upper,
    })),
  };

  const scenarioCompare: VisualizationResponse = {
    visualization: true,
    type: "scenario_compare",
    title: "Scenario Peaks (Bull/Base/Bear)",
    unit: "units",
    baseline: { label: "commit", value: scenario.planner.production_commit },
    data: [
      { label: "Bull", value: sku.scenarios.bull.peak_demand },
      { label: "Base", value: sku.scenarios.base.peak_demand },
      { label: "Bear", value: sku.scenarios.bear.peak_demand },
    ],
  };

  const inventoryBacklog: VisualizationResponse = {
    visualization: true,
    type: "inventory_backlog",
    title: "Backlog vs Inventory Target",
    unit: "days",
    baseline: null,
    data: [
      { label: "Backlog", value: scenario.signals.backlog_days },
      { label: "Target", value: scenario.planner.inventory_target_days },
    ],
  };

  const freight: VisualizationResponse = {
    visualization: true,
    type: "freight",
    title: "Freight Volume Index",
    unit: "index",
    baseline: { label: "base", value: 100 },
    data: [
      { label: "Index", value: scenario.signals.freight_index },
      { label: "MoM %", value: scenario.signals.freight_mom_pct },
    ],
  };

  const cancelRate: VisualizationResponse = {
    visualization: true,
    type: "cancel_rate",
    title: "Order Cancel Rate (Bull/Base/Bear)",
    unit: "%",
    baseline: null,
    data: [
      { label: "Bull", value: sku.scenarios.bull.signals.cancel_rate },
      { label: "Base", value: sku.scenarios.base.signals.cancel_rate },
      { label: "Bear", value: sku.scenarios.bear.signals.cancel_rate },
    ],
  };

  const pmiSensitivity: VisualizationResponse = {
    visualization: true,
    type: "pmi_sensitivity",
    title: `PMI Sensitivity (W1 demand @ PMI ${basePmi.toFixed(1)} vs ${pmiTarget.toFixed(1)})`,
    unit: "units/wk",
    baseline: null,
    data: [
      { label: "Base", value: baseW1 },
      { label: "Target", value: projW1 },
    ],
  };

  return [demandTrend, scenarioCompare, inventoryBacklog, pmiSensitivity, freight, cancelRate];
}

function ReportPdfView({
  title,
  sku,
  activeScenario,
  assistantContent,
  visualization,
}: {
  title: string;
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
  assistantContent: string;
  visualization: VisualizationResponse | null;
}) {
  const scenario = sku.scenarios[activeScenario];
  const defaultVisuals = buildDefaultVisuals(sku, activeScenario);

  const statusFromGap = (gapUnits: number) => {
    if (gapUnits >= 60) return { label: "Ramp", color: "#059669" };
    if (gapUnits >= 15) return { label: "Increase", color: "#2563eb" };
    if (gapUnits <= -60) return { label: "Cut", color: "#dc2626" };
    if (gapUnits <= -15) return { label: "Reduce", color: "#d97706" };
    return { label: "Hold", color: "#334155" };
  };

  const riskLevel = () => {
    const pmi = scenario.signals.pmi;
    const cancel = scenario.signals.cancel_rate;
    const backlog = scenario.signals.backlog_days;
    let score = 0;
    if (pmi < 48) score += 2;
    else if (pmi < 50) score += 1;
    if (cancel >= 7) score += 2;
    else if (cancel >= 4) score += 1;
    if (backlog < 25) score += 1;
    if (scenario.planner.alignment_confidence < 80) score += 1;
    if (score >= 5) return { label: "High", color: "#dc2626" };
    if (score >= 3) return { label: "Medium", color: "#d97706" };
    return { label: "Low", color: "#059669" };
  };

  const next12 = scenario.forecast.slice(0, 12).map((w) => w.demand);
  const avg12w = next12.length ? Math.round(next12.reduce((a, b) => a + b, 0) / next12.length) : 0;
  const peak = scenario.peak_demand;
  const commit = scenario.planner.production_commit;
  const gap = avg12w - commit;

  const stance = statusFromGap(gap);
  const risk = riskLevel();

  const suggestedCommit = (() => {
    // Default to aligning to 12W average; cap to not exceed peak unless gap is large.
    const target = avg12w;
    if (target <= 0) return commit;
    const capped = Math.min(target, peak);
    // Snap to nearest 10 units for readability.
    return Math.round(capped / 10) * 10;
  })();

  const actionPlan = {
    days30: [] as string[],
    days60: [] as string[],
    days90: [] as string[],
  };

  if (gap >= 15) {
    actionPlan.days30.push(`Increase production commit from ${commit.toLocaleString()} to ~${suggestedCommit.toLocaleString()} ${sku.unit}/wk; confirm capacity + labor.`);
    actionPlan.days30.push(`Pull forward procurement to Week ${Math.max(1, scenario.planner.procurement_week - 1)}; lock critical components for the next 4–6 weeks.`);
    actionPlan.days30.push(`Set exception monitoring: if cancel rate rises above ${(scenario.signals.cancel_rate + 2).toFixed(1)}%, pause further ramps.`);
    actionPlan.days60.push(`Build buffer to ${scenario.planner.inventory_target_days} days cover; rebalance DC allocations to top demand lanes.`);
    actionPlan.days60.push(`Run supplier risk review for freight index ${scenario.signals.freight_index}; pre-book capacity if it trends up.`);
    actionPlan.days60.push(`Tighten S&OP cadence: weekly commit vs forecast variance + service-level impact.`);
    actionPlan.days90.push(`Validate forecast drivers: PMI (${scenario.signals.pmi.toFixed(1)}) and backlog (${scenario.signals.backlog_days}d); revise assumptions if trend changes.`);
    actionPlan.days90.push(`Optimize cost-to-serve: consolidate shipments and renegotiate expedited freight thresholds.`);
    actionPlan.days90.push(`Institutionalize scenario triggers (Bull/Base/Bear) with pre-approved playbooks.`);
  } else if (gap <= -15) {
    actionPlan.days30.push(`Reduce production commit by ${Math.min(Math.abs(gap), Math.round(commit * 0.1))} ${sku.unit}/wk to avoid excess inventory.`);
    actionPlan.days30.push(`Delay procurement beyond Week ${scenario.planner.procurement_week} unless lead-times require commitments.`);
    actionPlan.days30.push(`Increase cancellation monitoring: if cancel rate stays above ${scenario.signals.cancel_rate.toFixed(1)}%, tighten order confirmation windows.`);
    actionPlan.days60.push(`Lower inventory target by 5–10 days and prioritize sell-through; reduce slow-moving SKUs.`);
    actionPlan.days60.push(`Review pricing / promo levers to stimulate demand without margin erosion.`);
    actionPlan.days60.push(`Re-forecast with latest PMI/freight and validate customer backlog health.`);
    actionPlan.days90.push(`Rebalance capacity to higher-confidence products; keep optionality via flexible labor/outsourcing.`);
    actionPlan.days90.push(`Implement early-warning dashboard for demand reversal (PMI, cancel rate, backlog).`);
    actionPlan.days90.push(`Negotiate supplier flexibility clauses (MOQ, reschedule windows).`);
  } else {
    actionPlan.days30.push(`Hold production commit at ${commit.toLocaleString()} ${sku.unit}/wk; focus on execution quality (service + cost).`);
    actionPlan.days30.push(`Validate procurement trigger Week ${scenario.planner.procurement_week}; confirm lead-times for long-tail parts.`);
    actionPlan.days30.push(`Tighten monitoring on cancel rate (${scenario.signals.cancel_rate.toFixed(1)}%) and freight MoM (${scenario.signals.freight_mom_pct.toFixed(1)}%).`);
    actionPlan.days60.push(`Optimize inventory positioning toward ${scenario.planner.inventory_target_days} days cover; reduce stockouts in top lanes.`);
    actionPlan.days60.push(`Run scenario drill: define triggers to move from ${activeScenario.toUpperCase()} → Bull/Bear.`);
    actionPlan.days60.push(`Calibrate forecast error buffers using model accuracy (1M MAPE ${sku.model_accuracy.ensemble_mape_1m}%).`);
    actionPlan.days90.push(`Negotiate freight and supplier terms based on volume outlook; lock rebates where possible.`);
    actionPlan.days90.push(`Codify decision rules for commit changes (e.g., Δavg12w vs commit thresholds).`);
    actionPlan.days90.push(`Expand signal coverage (FX, cancellations by channel) if available.`);
  }

  const narrative = markdownToPlainText(cleanContent(assistantContent));
  const narrativeLines = narrative.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const execBullets = [
    `12-week average demand is ${avg12w.toLocaleString()} ${sku.unit}/wk vs commit ${commit.toLocaleString()} (${gap >= 0 ? "+" : ""}${gap.toLocaleString()} ${sku.unit}/wk).`,
    `Peak demand is ${peak.toLocaleString()} ${sku.unit}; stance: ${stance.label} (alignment confidence ${scenario.planner.alignment_confidence}%).`,
    `Risk level: ${risk.label} — PMI ${scenario.signals.pmi.toFixed(1)}, cancel rate ${scenario.signals.cancel_rate.toFixed(1)}%, backlog ${scenario.signals.backlog_days}d.`,
  ];

  const watchlist = [
    `PMI trigger: <48 contraction risk; current ${scenario.signals.pmi.toFixed(1)} (${scenario.signals.pmi_trend}).`,
    `Cancel rate trigger: >7% indicates demand reversal; current ${scenario.signals.cancel_rate.toFixed(1)}%.`,
    `Backlog trigger: <25 days reduces demand visibility; current ${scenario.signals.backlog_days} days.`,
    `Freight trigger: index >110 or MoM spike; current ${scenario.signals.freight_index} (${scenario.signals.freight_mom_pct >= 0 ? "+" : ""}${scenario.signals.freight_mom_pct.toFixed(1)}% MoM).`,
  ];

  const tableRows = [
    { scenario: "Bull", peak: sku.scenarios.bull.peak_demand },
    { scenario: "Base", peak: sku.scenarios.base.peak_demand },
    { scenario: "Bear", peak: sku.scenarios.bear.peak_demand },
  ].map((r) => ({
    ...r,
    commit,
    gap: r.peak - commit,
  }));

  return (
    <div style={{ padding: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>{title}</div>
          <div style={{ marginTop: 6, fontSize: 11, color: "#475569" }}>
            Generated: {new Date().toLocaleString()} &nbsp; | &nbsp; SKU: {sku.name} &nbsp; | &nbsp; Scenario: {activeScenario.toUpperCase()}
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#64748b", textAlign: "right" }}>
          <div style={{ fontWeight: 800 }}>DemandSense</div>
          <div>Prediction Studio</div>
        </div>
      </div>

      <div style={{ height: 1, background: "#e2e8f0", marginTop: 14 }} />

      <Section title="Executive Summary">
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#ffffff" }}>
          {execBullets.map((b, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, marginTop: idx === 0 ? 0 : 6, fontSize: 11, lineHeight: 1.45 }}>
              <div style={{ fontWeight: 900, color: "#2563eb" }}>•</div>
              <div style={{ color: "#0f172a" }}>{b}</div>
            </div>
          ))}
          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ padding: "6px 10px", borderRadius: 999, background: "#f1f5f9", fontSize: 10, fontWeight: 900, color: "#334155" }}>
              Recommended stance: <span style={{ color: stance.color }}>{stance.label}</span>
            </div>
            <div style={{ padding: "6px 10px", borderRadius: 999, background: "#f1f5f9", fontSize: 10, fontWeight: 900, color: "#334155" }}>
              Risk: <span style={{ color: risk.color }}>{risk.label}</span>
            </div>
            <div style={{ padding: "6px 10px", borderRadius: 999, background: "#f1f5f9", fontSize: 10, fontWeight: 900, color: "#334155" }}>
              Suggested commit: <span style={{ color: "#0f172a" }}>{suggestedCommit.toLocaleString()} {sku.unit}/wk</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Key KPIs">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <KpiCard label="12W Avg Forecast" value={`${avg12w.toLocaleString()} ${sku.unit}/wk`} />
          <KpiCard label="Production Commit" value={`${commit.toLocaleString()} ${sku.unit}/wk`} />
          <KpiCard label="Gap vs Commit" value={`${gap >= 0 ? "+" : ""}${gap.toLocaleString()} ${sku.unit}/wk`} />
          <KpiCard label="Peak Demand" value={`${peak.toLocaleString()} ${sku.unit}`} />
          <KpiCard label="Inventory Target" value={`${scenario.planner.inventory_target_days} days`} />
          <KpiCard label="Backlog" value={`${scenario.signals.backlog_days} days`} />
        </div>
      </Section>

      <Section title="Planner Outputs">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <KpiCard label="Procurement Trigger" value={`Week ${scenario.planner.procurement_week}`} />
          <KpiCard label="Action Status" value={scenario.planner.action_status} />
          <KpiCard label="FX Index" value={`${scenario.signals.fx_index}`} />
        </div>
      </Section>

      <Section title="Visuals">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {visualization && <VisualizationChartStatic vis={visualization} height={170} />}
          {defaultVisuals.slice(0, 4).map((v, idx) => (
            <VisualizationChartStatic key={idx} vis={v} height={170} />
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            <VisualizationChartStatic vis={defaultVisuals[4]} height={170} />
            <VisualizationChartStatic vis={defaultVisuals[5]} height={170} />
          </div>
        </div>
      </Section>

      <Section title="Scenario Comparison">
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "#f1f5f9", padding: "10px 12px", fontSize: 10, fontWeight: 900, color: "#334155", textTransform: "uppercase", letterSpacing: 0.8 }}>
            <div>Scenario</div>
            <div>Peak</div>
            <div>Commit</div>
            <div>Gap</div>
          </div>
          {tableRows.map((r) => (
            <div key={r.scenario} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "10px 12px", fontSize: 11, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 800 }}>{r.scenario}</div>
              <div>{r.peak.toLocaleString()}</div>
              <div>{r.commit.toLocaleString()}</div>
              <div style={{ color: r.gap >= 0 ? "#059669" : "#dc2626", fontWeight: 800 }}>{r.gap >= 0 ? "+" : ""}{r.gap.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Risks & Watchlist">
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#ffffff" }}>
          {watchlist.map((w, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, marginTop: idx === 0 ? 0 : 6, fontSize: 11, lineHeight: 1.45 }}>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>•</div>
              <div style={{ color: "#0f172a" }}>{w}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="30 / 60 / 90 Day Action Plan">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { k: "30 days", items: actionPlan.days30 },
            { k: "60 days", items: actionPlan.days60 },
            { k: "90 days", items: actionPlan.days90 },
          ].map((col) => (
            <div key={col.k} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#ffffff" }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: "#334155", textTransform: "uppercase", letterSpacing: 0.8 }}>{col.k}</div>
              <div style={{ marginTop: 8 }}>
                {col.items.slice(0, 4).map((it, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, marginTop: idx === 0 ? 0 : 6, fontSize: 11, lineHeight: 1.45 }}>
                    <div style={{ fontWeight: 900, color: "#2563eb" }}>•</div>
                    <div style={{ color: "#0f172a" }}>{it}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Scenario Assumptions">
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#ffffff", fontSize: 11, lineHeight: 1.5 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>Bull</div>
            <div style={{ color: "#0f172a" }}>{sku.scenarios.bull.assumption}</div>
            <div style={{ fontWeight: 900 }}>Base</div>
            <div style={{ color: "#0f172a" }}>{sku.scenarios.base.assumption}</div>
            <div style={{ fontWeight: 900 }}>Bear</div>
            <div style={{ color: "#0f172a" }}>{sku.scenarios.bear.assumption}</div>
          </div>
        </div>
      </Section>

      <Section title="Advisor Narrative (End-to-End)">
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#ffffff" }}>
          {narrativeLines.length ? (
            <div style={{ fontSize: 11, lineHeight: 1.45, color: "#0f172a" }}>
              {narrativeLines.map((l, idx) => (
                <div key={idx} style={{ marginTop: idx === 0 ? 0 : 6 }}>{l}</div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#475569" }}>
              No narrative content captured.
            </div>
          )}
        </div>
      </Section>

      <Section title="Signals Snapshot">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <KpiCard label="PMI" value={`${scenario.signals.pmi.toFixed(1)}`} />
          <KpiCard label="Freight Index" value={`${scenario.signals.freight_index}`} />
          <KpiCard label="Cancel Rate" value={`${scenario.signals.cancel_rate.toFixed(1)}%`} />
          <KpiCard label="Alignment Confidence" value={`${scenario.planner.alignment_confidence}%`} />
        </div>
      </Section>

      <div style={{ marginTop: 18, fontSize: 9, color: "#64748b" }}>
        Notes: Visuals reflect scenario data in this session. Baselines use current production commit where applicable.
      </div>
    </div>
  );
}

function getLatestUserQuestion(messages: AdvisorMessage[], assistantIndex: number): string {
  for (let j = assistantIndex - 1; j >= 0; j -= 1) {
    if (messages[j]?.role === "user") return messages[j].content;
  }
  return "";
}

function parsePmiTarget(userQ: string): number | null {
  const m = userQ.match(/pmi\s*(?:is|to|at|=|drops?\s+to|goes?\s+to)?\s*(-?\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

// ── Visualisation components ──────────────────────────────────────────────────

function VisualCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-[hsl(var(--ds-border-subtle))] bg-[hsl(var(--background))] p-3 not-prose">
      <div className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--ds-text-tertiary))]">
        {title}
      </div>
      {children}
    </div>
  );
}

function VisualizationChart({ vis }: { vis: VisualizationResponse }) {
  const unit = vis.unit ? ` ${vis.unit}` : "";
  const title = vis.title || "Visualization";

  const hasRange = vis.data.some((p) => typeof p.low === "number" || typeof p.high === "number");
  const baselineVal = vis.baseline?.value;

  const data = vis.data.map((p) => ({
    label: p.label,
    value: p.value,
    low: p.low,
    high: p.high,
  }));

  const chartConfig = {
    value: { label: "Value", color: "#2563eb" },
    low: { label: "Low", color: "#94a3b8" },
    high: { label: "High", color: "#94a3b8" },
  } as const;

  const tooltipFormatter = (value: any) => {
    if (typeof value === "number") return `${value.toLocaleString()}${unit}`;
    return `${String(value)}${unit}`;
  };

  const isTrend = vis.type === "demand_trend";

  return (
    <VisualCard title={title}>
      <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
        {isTrend ? (
          <LineChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} formatter={tooltipFormatter as any} />
            {typeof baselineVal === "number" && Number.isFinite(baselineVal) && (
              <ReferenceLine y={baselineVal} stroke="#2563eb" strokeDasharray="4 3" />
            )}
            {hasRange && (
              <>
                <Line type="monotone" dataKey="low" stroke="var(--color-low)" strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="high" stroke="var(--color-high)" strokeDasharray="4 4" dot={false} />
              </>
            )}
            <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={false} />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} formatter={tooltipFormatter as any} />
            {typeof baselineVal === "number" && Number.isFinite(baselineVal) && (
              <ReferenceLine y={baselineVal} stroke="#2563eb" strokeDasharray="4 3" />
            )}
            <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} />
          </BarChart>
        )}
      </ChartContainer>
    </VisualCard>
  );
}

function LlmVisual({ visual }: { visual: StructuredVisual }) {
  const points = (visual.data && visual.data.length > 0)
    ? visual.data
    : visual.series?.[0]?.data ?? [];

  if (!points || points.length === 0) return null;

  const toNum = (v: number | string | undefined) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const cleaned = v.replace(/[^0-9.-]/g, "");
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const maxValue = Math.max(
    1,
    ...points.map((p) => Math.max(toNum(p.high ?? p.value), toNum(p.value))),
    toNum(visual.baseline?.value)
  );

  const baselineVal = visual.baseline?.value != null ? toNum(visual.baseline.value) : null;
  const baselinePct = baselineVal != null
    ? Math.min(100, Math.max(0, Math.round((baselineVal / maxValue) * 100)))
    : null;

  const unit = visual.unit ? ` ${visual.unit}` : "";
  const title = visual.title || "AI Generated Visual";

  return (
    <VisualCard title={title}>
      <div className="relative h-20 flex items-end gap-1">
        {baselinePct != null && (
          <div
            className="absolute inset-x-0 border-t border-dashed border-blue-400/60 pointer-events-none"
            style={{ bottom: `${baselinePct}%` }}
            title={`${visual.baseline?.label || "baseline"}: ${visual.baseline?.value}${unit}`}
          />
        )}
        {points.map((p, idx) => {
          const mid = toNum(p.value);
          const low = toNum(p.low);
          const high = toNum(p.high ?? p.value);
          const midPct = Math.round((mid / maxValue) * 100);
          const lowPct = Math.round((low / maxValue) * 100);
          const highPct = Math.round((high / maxValue) * 100);
          return (
            <div key={`${p.label ?? idx}`} className="flex-1 relative flex items-end h-full" title={`${p.label ?? ""}: ${mid}${unit}`}>
              {visual.type === "bar_range" && high > low && (
                <div
                  className="absolute inset-x-0 rounded bg-blue-100"
                  style={{ bottom: `${lowPct}%`, height: `${Math.max(0, highPct - lowPct)}%` }}
                />
              )}
              <div
                className="relative w-full rounded bg-blue-500"
                style={{ height: `${Math.max(2, midPct)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-[hsl(var(--ds-text-tertiary))]">
        <span>{points[0]?.label ?? "Start"} · {toNum(points[0]?.value)}{unit}</span>
        {baselinePct != null && (
          <span className="text-blue-500">── {visual.baseline?.label || "baseline"} {baselineVal}{unit}</span>
        )}
        <span>{points[points.length - 1]?.label ?? "End"} · {toNum(points[points.length - 1]?.value)}{unit}</span>
      </div>
    </VisualCard>
  );
}

function DemandTrendVis({ sku, activeScenario }: { sku: SKUData; activeScenario: "bull" | "base" | "bear" }) {
  const scenario = sku.scenarios[activeScenario];
  const weeks = scenario.forecast.slice(0, 8).map((w, i) => ({
    week: i + 1,
    demand: w.demand,
    lower: w.lower,
    upper: w.upper,
  }));
  const max = Math.max(...weeks.map((w) => w.upper), 1);
  const commit = scenario.planner.production_commit;
  const commitPct = Math.round((commit / max) * 100);

  return (
    <VisualCard title="8-Week Demand Forecast">
      <div className="relative h-20 flex items-end gap-1">
        {/* Commit line */}
        <div
          className="absolute inset-x-0 border-t border-dashed border-blue-400/60 pointer-events-none"
          style={{ bottom: `${commitPct}%` }}
        />
        {weeks.map((w) => {
          const loPct = Math.round((w.lower / max) * 100);
          const hiPct = Math.round((w.upper / max) * 100);
          const midPct = Math.round((w.demand / max) * 100);
          return (
            <div key={w.week} className="flex-1 relative flex items-end h-full" title={`W${w.week}: ${w.demand} units`}>
              {/* Range band */}
              <div
                className="absolute inset-x-0 rounded bg-blue-100"
                style={{ bottom: `${loPct}%`, height: `${hiPct - loPct}%` }}
              />
              {/* Mid bar */}
              <div
                className="relative w-full rounded bg-blue-500"
                style={{ height: `${midPct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-[hsl(var(--ds-text-tertiary))]">
        <span>W1 · {weeks[0].demand}</span>
        <span className="text-blue-500">── commit {commit}/wk</span>
        <span>W8 · {weeks[7].demand}</span>
      </div>
    </VisualCard>
  );
}

function ScenarioCompareVis({ sku, activeScenario }: { sku: SKUData; activeScenario: "bull" | "base" | "bear" }) {
  const commit = sku.scenarios[activeScenario].planner.production_commit;
  const rows = [
    { label: "Bull", key: "bull", peak: sku.scenarios.bull.peak_demand, color: "bg-emerald-500" },
    { label: "Base", key: "base", peak: sku.scenarios.base.peak_demand, color: "bg-blue-500" },
    { label: "Bear", key: "bear", peak: sku.scenarios.bear.peak_demand, color: "bg-amber-500" },
  ];
  const max = Math.max(...rows.map((r) => r.peak), 1);

  return (
    <VisualCard title="Scenario Peak vs Commit">
      <div className="space-y-2.5">
        {rows.map((r) => {
          const gap = r.peak - commit;
          const pct = Math.max(6, Math.round((r.peak / max) * 100));
          return (
            <div key={r.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={clsx("font-semibold", r.key === activeScenario && "underline underline-offset-2")}>{r.label}</span>
                <span className="text-[hsl(var(--ds-text-secondary))]">
                  {r.peak.toLocaleString()} units &nbsp;
                  <span className={gap >= 0 ? "text-emerald-600" : "text-red-500"}>
                    {gap >= 0 ? "+" : ""}{gap}
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                <div className={clsx("h-full rounded-full transition-all", r.color)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        <div className="text-[10px] text-[hsl(var(--ds-text-tertiary))] pt-1">
          Commit: {commit.toLocaleString()} units/wk &nbsp;·&nbsp; Active: {activeScenario}
        </div>
      </div>
    </VisualCard>
  );
}

function PmiSensitivityVis({
  sku,
  activeScenario,
  userQuestion,
}: {
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
  userQuestion: string;
}) {
  const scenario = sku.scenarios[activeScenario];
  const basePmi = scenario.signals.pmi;
  const pmiTarget = parsePmiTarget(userQuestion) ?? basePmi - 5;
  const deltaPct = (pmiTarget - basePmi) * 0.8;
  const baseW1 = scenario.forecast[0]?.demand ?? 0;
  const projW1 = Math.max(0, Math.round(baseW1 * (1 + deltaPct / 100)));
  const max = Math.max(baseW1, projW1, 1);

  return (
    <VisualCard title="PMI Sensitivity">
      <div className="grid grid-cols-3 gap-2 text-[11px] mb-3">
        {[
          { label: "Base PMI", val: basePmi, color: "text-blue-500" },
          { label: "Target PMI", val: pmiTarget, color: pmiTarget > basePmi ? "text-emerald-600" : "text-red-500" },
          {
            label: "Demand Δ",
            val: `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`,
            color: deltaPct >= 0 ? "text-emerald-600" : "text-red-500",
          },
        ].map((c) => (
          <div key={c.label} className="rounded-lg bg-[hsl(var(--muted))] p-2 text-center">
            <div className="text-[hsl(var(--ds-text-tertiary))] text-[10px] mb-0.5">{c.label}</div>
            <div className={clsx("font-bold text-sm", c.color)}>{c.val}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2 text-xs">
        {[
          { label: "Current W1", val: baseW1, color: "bg-blue-500", pct: Math.round((baseW1 / max) * 100) },
          { label: "Projected W1", val: projW1, color: projW1 > baseW1 ? "bg-emerald-500" : "bg-red-400", pct: Math.round((projW1 / max) * 100) },
        ].map((row) => (
          <div key={row.label}>
            <div className="flex justify-between mb-1">
              <span className="text-[hsl(var(--ds-text-secondary))]">{row.label}</span>
              <span className="font-semibold">{row.val} units</span>
            </div>
            <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
              <div className={clsx("h-full rounded-full transition-all", row.color)} style={{ width: `${row.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </VisualCard>
  );
}

function InventoryVis({ sku, activeScenario }: { sku: SKUData; activeScenario: "bull" | "base" | "bear" }) {
  const scenario = sku.scenarios[activeScenario];
  const backlog = scenario.signals.backlog_days;
  const target = scenario.planner.inventory_target_days;
  const procTrigger = scenario.planner.procurement_week;
  const confidence = scenario.planner.alignment_confidence;
  const backlogColor = backlog > 40 ? "#059669" : backlog >= 25 ? "#d97706" : "#dc2626";
  const backlogPct = Math.min(Math.round((backlog / 70) * 100), 100);
  const targetPct = Math.min(Math.round((target / 70) * 100), 100);

  return (
    <VisualCard title="Inventory & Backlog">
      <div className="space-y-2.5">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[hsl(var(--ds-text-secondary))]">Backlog days</span>
            <span className="font-bold" style={{ color: backlogColor }}>{backlog} days</span>
          </div>
          <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${backlogPct}%`, backgroundColor: backlogColor }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[hsl(var(--ds-text-secondary))]">Target cover</span>
            <span className="font-bold text-blue-500">{target} days</span>
          </div>
          <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
            <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${targetPct}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
          <div className="rounded-lg bg-[hsl(var(--muted))] p-2">
            <div className="text-[hsl(var(--ds-text-tertiary))] text-[10px]">Procurement trigger</div>
            <div className="font-bold">Week {procTrigger}</div>
          </div>
          <div className="rounded-lg bg-[hsl(var(--muted))] p-2">
            <div className="text-[hsl(var(--ds-text-tertiary))] text-[10px]">Alignment confidence</div>
            <div className="font-bold text-emerald-600">{confidence}%</div>
          </div>
        </div>
      </div>
    </VisualCard>
  );
}

function FreightVis({ sku, activeScenario }: { sku: SKUData; activeScenario: "bull" | "base" | "bear" }) {
  const signals = sku.scenarios[activeScenario].signals;
  const idx = signals.freight_index;
  const mom = signals.freight_mom_pct;
  const idxPct = Math.min(Math.round((idx / 150) * 100), 100);
  const momColor = mom >= 0 ? "#059669" : "#dc2626";

  return (
    <VisualCard title="Freight Volume Index">
      <div className="flex items-center gap-4 mb-3">
        <div className="flex-1">
          <div className="text-[32px] font-bold leading-none tabular-nums" style={{ color: "hsl(var(--ds-text-primary))" }}>
            {idx}
          </div>
          <div className="text-[11px] text-[hsl(var(--ds-text-tertiary))] mt-0.5">Base index 100</div>
        </div>
        <div
          className="text-sm font-bold px-3 py-1.5 rounded-full"
          style={{
            backgroundColor: mom >= 0 ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)",
            color: momColor,
          }}
        >
          {mom >= 0 ? "+" : ""}{mom.toFixed(1)}% MoM
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${idxPct}%`,
            backgroundColor: idx >= 105 ? "#059669" : idx >= 95 ? "#2563eb" : "#d97706",
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[hsl(var(--ds-text-tertiary))] mt-1">
        <span>0</span>
        <span>Base: 100</span>
        <span>150</span>
      </div>
    </VisualCard>
  );
}

function CancelRateVis({ sku, activeScenario }: { sku: SKUData; activeScenario: "bull" | "base" | "bear" }) {
  const signals = sku.scenarios[activeScenario].signals;
  const rate = signals.cancel_rate;
  const ratePct = Math.min(Math.round((rate / 15) * 100), 100);
  const rateColor = rate < 3 ? "#059669" : rate <= 7 ? "#d97706" : "#dc2626";
  const rateLabel = rate < 3 ? "Low — healthy" : rate <= 7 ? "Moderate — watch" : "High — action needed";

  // 12-week scenario rates for context
  const allRates = [
    { label: "Bull", rate: sku.scenarios.bull.signals.cancel_rate, color: "bg-emerald-500" },
    { label: "Base", rate: sku.scenarios.base.signals.cancel_rate, color: "bg-blue-500" },
    { label: "Bear", rate: sku.scenarios.bear.signals.cancel_rate, color: "bg-amber-500" },
  ];
  const maxRate = Math.max(...allRates.map((r) => r.rate), 1);

  return (
    <VisualCard title="Order Cancel Rate">
      <div className="flex items-start gap-3 mb-3">
        <div>
          <span className="text-[32px] font-bold leading-none tabular-nums" style={{ color: rateColor }}>
            {rate.toFixed(1)}
          </span>
          <span className="text-sm font-semibold text-[hsl(var(--ds-text-tertiary))] ml-1">%</span>
        </div>
        <span
          className="mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${rateColor}18`, color: rateColor }}
        >
          {rateLabel}
        </span>
      </div>
      <div className="space-y-1.5">
        {allRates.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="text-[10px] w-8 text-[hsl(var(--ds-text-tertiary))]">{r.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
              <div
                className={clsx("h-full rounded-full", r.color)}
                style={{ width: `${Math.round((r.rate / maxRate) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold w-8 text-right">{r.rate.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </VisualCard>
  );
}

// ── Main dynamic visual dispatcher ───────────────────────────────────────────
function DynamicVisuals({
  sku,
  activeScenario,
  visualType,
  userQuestion,
}: {
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
  visualType: VisualType;
  userQuestion: string;
}) {
  if (visualType === "NONE") return null;

  if (visualType === "PMI_SENSITIVITY")
    return <PmiSensitivityVis sku={sku} activeScenario={activeScenario} userQuestion={userQuestion} />;

  if (visualType === "SCENARIO_COMPARE")
    return <ScenarioCompareVis sku={sku} activeScenario={activeScenario} />;

  if (visualType === "DEMAND_TREND")
    return <DemandTrendVis sku={sku} activeScenario={activeScenario} />;

  if (visualType === "INVENTORY")
    return <InventoryVis sku={sku} activeScenario={activeScenario} />;

  if (visualType === "FREIGHT")
    return <FreightVis sku={sku} activeScenario={activeScenario} />;

  if (visualType === "CANCEL_RATE")
    return <CancelRateVis sku={sku} activeScenario={activeScenario} />;

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AIAdvisor({ sku, activeScenario, currentSliders }: AIAdvisorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Record<number, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevContextRef = useRef({ skuId: sku.id, scenario: activeScenario });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    const prev = prevContextRef.current;
    if (isOpen && (prev.skuId !== sku.id || prev.scenario !== activeScenario)) {
      setMessages((m) => [
        ...m,
        { role: "system", content: `Context updated to ${sku.name} — ${activeScenario} scenario` },
      ]);
    }
    prevContextRef.current = { skuId: sku.id, scenario: activeScenario };
  }, [sku.id, activeScenario, isOpen, sku.name]);

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg: AdvisorMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    const ctx: AdvisorContext = { sku, activeScenario, currentSliders };
    const allMessages = [...messages.filter((m) => m.role !== "system"), userMsg];

    try {
      await streamAdvisor({
        messages: allMessages,
        ctx,
        onDelta: (chunk) => {
          assistantSoFar += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
            }
            return [...prev, { role: "assistant", content: assistantSoFar }];
          });
        },
        onDone: () => setLoading(false),
        onError: (err) => { toast.error(err); setLoading(false); },
      });
    } catch {
      toast.error("Failed to reach advisor. Please try again.");
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (loading) return;
    await handleSend(
      "Generate a 1-page executive demand planning report for the current SKU and active scenario.\n\nFormat rules:\n- PLAIN TEXT only (no JSON, no markdown tables).\n- Use clear section headings and bullet points.\n- Be specific and quantitative (use session numbers).\n\nRequired sections:\n1) Executive Summary (3 bullets)\n2) KPI Snapshot (6 bullets with values + units)\n3) Scenario Comparison (Bull/Base/Bear: peak, commit, gap vs commit, stance)\n4) Key Risks & Watchlist (4–6 bullets)\n5) 30/60/90 Day Action Plan (3 bullets per horizon)\n6) Final Recommendation (1–2 sentences)"
    );
  };

  const handleDownloadMessage = async (msg: AdvisorMessage, index: number) => {
    const cleaned = cleanContent(msg.content);
    const visualization = parseVisualizationResponse(cleaned);
    const ts = new Date().toISOString().slice(0, 10);
    const name = `${sku.id}-${activeScenario}-advisor-report-${ts}-${index}.pdf`;
    try {
      await downloadPdfReport({
        fileName: name,
        title: "Demand Planning Report",
        content: cleaned,
        sku,
        activeScenario,
        visualization,
      });
      toast.success("PDF report downloaded");
    } catch {
      toast.error("Failed to generate PDF report");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const autoResize = () => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-5 py-3 shadow-lg transition-all duration-300",
          "bg-[hsl(var(--ds-nav))] text-[hsl(var(--ds-nav-foreground))] hover:scale-105",
          isOpen && "scale-0 opacity-0 pointer-events-none"
        )}
      >
        <Bot className="h-5 w-5" />
        <span className="text-sm font-medium">Ask AI</span>
      </button>

      {/* Panel */}
      <div
        className={clsx(
          "fixed z-50 transition-all duration-300 ease-out",
          "bottom-0 right-0 top-0 w-full sm:w-[480px]",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-full flex-col bg-[hsl(var(--background))] border-l border-[hsl(var(--ds-border-subtle))] shadow-[-20px_0_50px_rgba(0,0,0,0.1)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[hsl(var(--ds-border-subtle))] px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--ds-nav))]">
                <Sparkles className="h-4 w-4 text-[hsl(var(--ds-nav-foreground))]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[hsl(var(--ds-text-primary))]">
                  DemandSense AI Advisor
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                 
                  <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded", SCENARIO_COLORS[activeScenario])}>
                    {activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleGenerateReport}
                disabled={loading}
                className={clsx(
                  "p-2 rounded-lg transition-colors",
                  loading
                    ? "text-[hsl(var(--ds-text-tertiary))] cursor-not-allowed"
                    : "text-[hsl(var(--ds-text-tertiary))] hover:bg-[hsl(var(--muted))]"
                )}
                title="Generate report"
              >
                <FileText className="h-4 w-4" />
              </button>
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="p-2 rounded-lg text-[hsl(var(--ds-text-tertiary))] hover:bg-[hsl(var(--muted))] transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg text-[hsl(var(--ds-text-tertiary))] hover:bg-[hsl(var(--muted))] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <>
                <div className="rounded-2xl rounded-tl-sm bg-[hsl(var(--muted))] border border-[hsl(var(--ds-border-subtle))] px-4 py-3 text-sm text-[hsl(var(--ds-text-secondary))] max-w-[92%]">
                  Hi! I'm your AI planning advisor. I have full visibility into your{" "}
                  <strong>{sku.name}</strong> forecast data across Bull, Base, and Bear scenarios.
                  Ask me anything about demand, profit levers, or risk management.
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="text-xs px-3 py-1.5 rounded-full border border-[hsl(var(--ds-border-subtle))] text-[hsl(var(--ds-text-secondary))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--ds-text-primary))] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((msg, i) => {
              if (msg.role === "system") {
                return (
                  <div key={i} className="text-center text-xs italic text-[hsl(var(--ds-text-tertiary))] py-1">
                    {msg.content}
                  </div>
                );
              }
              if (msg.role === "user") {
                return (
                  <div key={i} className="flex justify-end gap-2">
                    <div className="ds-chat-bubble-user text-sm max-w-[85%]">
                      {msg.content}
                    </div>
                    <div className="ds-chat-avatar ds-chat-avatar-user">
                      <User className="h-4 w-4" />
                    </div>
                  </div>
                );
              }

              // ── Assistant message ──
              const cleaned = cleanContent(msg.content);
              const structured = parseStructuredResponse(cleaned);
              const visualization = parseVisualizationResponse(cleaned);
              const isReportMsg = structured?.response_type === "report";
              const userQ = getLatestUserQuestion(messages, i);
              const userAskedReport = /\breport\b/i.test(userQ) || /\b(download|export)\b\s+\breport\b/i.test(userQ);
              const canDownloadReport = !visualization && (isReportMsg || userAskedReport);
              const fullWithoutTable = stripScenarioTable(cleaned);
              const compact = compactContent(cleaned);
              const isExpanded = !!expandedMessages[i];
              const displayContent = structured ? fullWithoutTable : (isExpanded ? fullWithoutTable : compact);
              const canExpand = !structured && fullWithoutTable.length > compact.length + 40;

              const trimmed = cleaned.trimStart();
              const jsonish = looksJsonish(trimmed);
              const seemsLikeStreamingVisualization =
                !visualization && jsonish && /"visualization"\s*:\s*true/.test(trimmed);
              const seemsLikeStreamingStructured =
                !structured && jsonish && /"response_type"\s*:\s*"(analysis|report)"/.test(trimmed);
              const isStreaming = loading && i === messages.length - 1;

              return (
                <div key={i} className="flex justify-start gap-2">
                  <div className="ds-chat-avatar ds-chat-avatar-bot">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="ds-chat-bubble text-sm leading-relaxed max-w-[90%] prose prose-sm prose-slate max-w-none break-words [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_strong]:text-[hsl(var(--ds-text-primary))]">
                    {visualization ? (
                      <VisualizationChart vis={visualization} />
                    ) : (isStreaming && (seemsLikeStreamingVisualization || seemsLikeStreamingStructured)) ? (
                      <div className="text-xs text-[hsl(var(--ds-text-secondary))]">
                        Formatting response…
                      </div>
                    ) : structured ? (
                      <StructuredResponseView data={structured} />
                    ) : (!isStreaming && jsonish) ? (
                      <ReactMarkdown>{humanizeAccidentalJson(cleaned)}</ReactMarkdown>
                    ) : (
                      <ReactMarkdown>{displayContent || "Working on it..."}</ReactMarkdown>
                    )}

                    {canExpand && (
                      <button
                        onClick={() => setExpandedMessages((prev) => ({ ...prev, [i]: !prev[i] }))}
                        className="mt-2 text-xs text-black underline font-medium text-[hsl(var(--ds-nav))] hover:underline"
                      >
                        {isExpanded ? "Show less" : "Show details"}
                      </button>
                    )}

                    {canDownloadReport && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => handleDownloadMessage(msg, i)}
                          className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--ds-border-subtle))] bg-[hsl(var(--background))] px-2 py-1 text-[11px] font-medium text-[hsl(var(--ds-text-secondary))] hover:text-[hsl(var(--ds-text-primary))]"
                          title="Download report PDF"
                        >
                          <Download className="h-3 w-3" />
                          Download report PDF
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start gap-2">
                <div className="ds-chat-avatar ds-chat-avatar-bot">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="ds-chat-bubble text-xs text-[hsl(var(--ds-text-secondary))]">
                  <span className="font-medium text-[hsl(var(--ds-text-primary))]">Generating</span>
                  <span className="ds-typing-dots ml-1">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[hsl(var(--ds-border-subtle))] p-3">
            <div className="flex items-center justify-between gap-2 px-1 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-[hsl(var(--ds-text-tertiary))]">Try:</span>
                {[
                  { label: "Forecast next 8 weeks", text: "Show the next 8-week demand forecast and what to do." },
                  { label: "Show chart", text: "Show a chart of W1–W8 demand trend." },
                  { label: "Scenario compare", text: "Show a chart comparing Bull/Base/Bear peak demand vs commit." },
                  { label: "Generate report", text: "Generate a 1-page executive planning report for this scenario." },
                ].map((c) => (
                  <button
                    key={c.label}
                    onClick={() => {
                      setInput(c.text);
                      requestAnimationFrame(() => {
                        textareaRef.current?.focus();
                        autoResize();
                      });
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-[hsl(var(--ds-border-subtle))] text-[hsl(var(--ds-text-secondary))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--ds-text-primary))] transition-colors"
                    type="button"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="hidden sm:block text-[11px] text-[hsl(var(--ds-text-tertiary))]">
                <span className="font-medium">Enter</span> send · <span className="font-medium">Shift+Enter</span> new line
              </div>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(); }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about scenarios, profit, risk… (say “show chart” to get a visualization)"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-[hsl(var(--ds-border-subtle))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--ds-text-primary))] placeholder:text-[hsl(var(--ds-text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent"
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className={clsx(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                  input.trim() && !loading
                    ? "bg-[hsl(var(--ds-nav))] text-[hsl(var(--ds-nav-foreground))] hover:opacity-90"
                    : "bg-[hsl(var(--muted))] text-[hsl(var(--ds-text-tertiary))] cursor-not-allowed"
                )}
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <div className="text-[11px] text-[hsl(var(--ds-text-tertiary))]">
                Tip: Ask for a chart explicitly to get a clean visualization payload.
              </div>
              <div className="text-[11px] text-[hsl(var(--ds-text-tertiary))] tabular-nums">
                {input.trim().length}/600
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop on mobile */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setIsOpen(false)} />
      )}
    </>
  );
}
