import type { SKUData } from "@/data/forecastData";

export interface AdvisorMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AdvisorContext {
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
  currentSliders?: {
    pmi: number;
    freight_index: number;
    backlog_days: number;
    cancel_rate: number;
  };
}

// ── Gemini model config ───────────────────────────────────────────────────────
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ── System prompt builder ─────────────────────────────────────────────────────
function buildSystemPrompt(ctx: AdvisorContext): string {
  const sku = ctx.sku;
  const scenario = sku.scenarios[ctx.activeScenario];
  const baseScenario = sku.scenarios.base;
  const bullScenario = sku.scenarios.bull;
  const bearScenario = sku.scenarios.bear;

  const next4WeeksDemand = scenario.forecast.slice(0, 4).map((w) => w.demand);
  const avg4w = Math.round(next4WeeksDemand.reduce((a, b) => a + b, 0) / 4);
  const next12WeeksDemand = scenario.forecast.slice(0, 12).map((w) => w.demand);
  const avg12w = Math.round(next12WeeksDemand.reduce((a, b) => a + b, 0) / 12);

  const recentActuals = sku.historical.slice(-4).map((h) => h.actual);
  const avgActual = Math.round(recentActuals.reduce((a, b) => a + b, 0) / 4);

  return `You are DemandSense AI Advisor — a senior supply chain and commercial planning expert
embedded inside an ML-powered demand forecasting platform.

You have access to live forecast data for this planning session. Use it precisely and
quantitatively in every answer. Be direct, decisive, and action-oriented.
Prioritise specific numbers over vague recommendations.

━━━ CURRENT SESSION DATA ━━━

SKU: ${sku.name} (${sku.category})
Unit: ${sku.unit}
Active scenario: ${ctx.activeScenario.toUpperCase()}

SIGNAL READINGS (${ctx.activeScenario} scenario):
- Manufacturing PMI: ${scenario.signals.pmi} (${scenario.signals.pmi_trend} trend)
  → ${scenario.signals.pmi > 52 ? "EXPANSION territory — demand likely to strengthen" : scenario.signals.pmi < 48 ? "CONTRACTION territory — demand likely to weaken" : "NEUTRAL zone — watch for breakout direction"}
- Freight Volume Index: ${scenario.signals.freight_index} (${scenario.signals.freight_mom_pct > 0 ? "+" : ""}${scenario.signals.freight_mom_pct}% MoM)
- Customer Backlog: ${scenario.signals.backlog_days} days
- Order Cancel Rate: ${scenario.signals.cancel_rate}%
- FX Index: ${scenario.signals.fx_index}

DEMAND FORECAST (${ctx.activeScenario}):
- Recent 4-week average actual: ${avgActual} ${sku.unit}/wk
- Next 4-week forecast avg: ${avg4w} ${sku.unit}/wk
- Next 12-week forecast avg: ${avg12w} ${sku.unit}/wk
- Peak demand (${ctx.activeScenario}): ${scenario.peak_demand} ${sku.unit}
- Forecast week 1: ${scenario.forecast[0]?.demand} ${sku.unit} (range: ${scenario.forecast[0]?.lower}–${scenario.forecast[0]?.upper})
- Forecast week 4: ${scenario.forecast[3]?.demand} ${sku.unit} (range: ${scenario.forecast[3]?.lower}–${scenario.forecast[3]?.upper})
- Forecast week 13: ${scenario.forecast[12]?.demand} ${sku.unit} (range: ${scenario.forecast[12]?.lower}–${scenario.forecast[12]?.upper})

SCENARIO COMPARISON:
- Bull scenario peak: ${bullScenario.peak_demand} ${sku.unit} — assumption: ${bullScenario.assumption}
- Base scenario peak: ${baseScenario.peak_demand} ${sku.unit} — assumption: ${baseScenario.assumption}
- Bear scenario peak: ${bearScenario.peak_demand} ${sku.unit} — assumption: ${bearScenario.assumption}

PLANNER OUTPUTS (${ctx.activeScenario}):
- Production commit: ${scenario.planner.production_commit} ${sku.unit}/wk
- Inventory target: ${scenario.planner.inventory_target_days} days cover
- Procurement trigger: Week ${scenario.planner.procurement_week}
- Alignment confidence: ${scenario.planner.alignment_confidence}%
- Action status: ${scenario.planner.action_status}

MODEL ACCURACY:
- ML Ensemble MAPE: ${sku.model_accuracy.ensemble_mape_1w}% (1W), ${sku.model_accuracy.ensemble_mape_1m}% (1M), ${sku.model_accuracy.ensemble_mape_3m}% (3M)
- Traditional baseline: ${sku.model_accuracy.baseline_mape_1w}% (1W), ${sku.model_accuracy.baseline_mape_1m}% (1M), ${sku.model_accuracy.baseline_mape_3m}% (3M)
- Overall improvement: ${sku.model_accuracy.overall_improvement_pct}%

${ctx.currentSliders ? `
CUSTOM SLIDER SETTINGS (user-adjusted):
- PMI: ${ctx.currentSliders.pmi}
- Freight Index: ${ctx.currentSliders.freight_index}
- Backlog Days: ${ctx.currentSliders.backlog_days}
- Cancel Rate: ${ctx.currentSliders.cancel_rate}%
` : ""}

━━━ RESPONSE RULES ━━━

**Case 1 (default): return PLAIN TEXT ONLY**
- For almost all questions, respond as normal chat text (no JSON, no code fences).
- Be concise and decision-ready (3–8 lines). Bullets are OK.
- Use numbers from the session data when relevant.
- If you find yourself starting to output JSON (for example you type '{' or '['): STOP and output plain text instead.
- Never output keys like "response_type", "impact", "actions", "visual" unless the user explicitly asked for a chart.

**Case 2 (when user asks for a graph/chart/visualisation): return JSON ONLY**
- If the user explicitly asks to "show a graph", "plot", "chart", "visualize", or "send the graph",
  return STRICT JSON only (no extra prose).
- The JSON must have a top-level field: "visualization": true
- Send ONLY the graph payload in JSON (no analysis blocks).

IMPORTANT:
- Do not guess that the user wants a chart. Only use Case 2 when they explicitly request a chart/graph/visual.
- In Case 2, do NOT include any commentary text outside JSON.

Use this exact JSON schema:
{
  "visualization": true,
  "type": "demand_trend" | "scenario_compare" | "pmi_sensitivity" | "inventory_backlog" | "freight" | "cancel_rate",
  "title": "short chart title",
  "unit": "units/wk" | "units" | "days" | "%" | "index",
  "baseline": { "label": "commit" | "target" | "base", "value": 0 } | null,
  "data": [
    { "label": "W1", "value": 0, "low": 0, "high": 0 }
  ]
}

Chart data rules (mandatory in Case 2):
- Values must be numeric (no units inside numbers).
- Labels must be meaningful:
  * demand_trend → W1..W8 using forecast demand; include low/high range.
  * scenario_compare → Bull/Base/Bear using peak_demand.
  * pmi_sensitivity → Base vs Target using week-1 demand; apply +0.8% demand per PMI point above base (negative below).
  * inventory_backlog → Backlog vs Target cover (days).
  * freight → Index and MoM% as two bars.
  * cancel_rate → Bull/Base/Bear cancel rate (%).
- baseline.value should usually be production_commit for demand/scenario charts.

Greeting/off-topic:
- Respond in 1–2 friendly sentences. Do not output JSON.

Report requests:
- If the user explicitly says "report" / "generate report" / "download report", respond in plain text with a brief report (still NOT JSON).`;
}

// ── Gemini content builder ────────────────────────────────────────────────────
// Gemini doesn't have a native system role in the same way as OpenAI.
// Convention: prefix the conversation with a user/model pair for system context.
function buildGeminiContents(
  messages: AdvisorMessage[],
  systemPrompt: string
): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  // System context injected as first user turn
  contents.push({ role: "user", parts: [{ text: `[SYSTEM CONTEXT]\n${systemPrompt}` }] });
  contents.push({ role: "model", parts: [{ text: "Understood. I have full context of this planning session and will respond according to all the rules specified." }] });

  // Real conversation history (skip any internal system messages)
  for (const m of messages) {
    if (m.role === "system") continue;
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }

  return contents;
}

// ── Main streaming function ───────────────────────────────────────────────────
export async function streamAdvisor({
  messages,
  ctx,
  onDelta,
  onDone,
  onError,
}: {
  messages: AdvisorMessage[];
  ctx: AdvisorContext;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) {
    onError("Gemini API key not configured (VITE_GEMINI_API_KEY).");
    return;
  }

  const systemPrompt = buildSystemPrompt(ctx);
  const contents = buildGeminiContents(messages, systemPrompt);

  // Use SSE streaming endpoint
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 4096,
        },
      }),
    });
  } catch (err) {
    onError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  if (!resp.ok) {
    let body = "";
    try { body = await resp.text(); } catch { /* ignore */ }
    const parsed = (() => { try { return JSON.parse(body); } catch { return null; } })();
    const msg = parsed?.error?.message || `Gemini API error ${resp.status}`;
    onError(msg);
    return;
  }

  if (!resp.body) {
    onError("No response stream from Gemini.");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data:")) continue;

        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(jsonStr);
          // Gemini SSE: candidates[0].content.parts[0].text
          const text: string | undefined =
            parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) onDelta(text);
        } catch {
          // Partial JSON — put back and wait for more data
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
  } catch (err) {
    onError(`Stream read error: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  onDone();
}
