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

**RULE 0 — MOST IMPORTANT: Read the user's intent first.**

- If the message is a greeting, pleasantry, or off-topic (e.g. "hi", "hello", "thanks", "how are you", "what can you do"):
  → Respond naturally and conversationally in 1–2 sentences. DO NOT use the CRISP template. DO NOT cite any numbers.
  → Example: "Hi! I'm DemandSense AI — ask me anything about your Electronics-A forecast, scenarios, or supply chain decisions."

- If the message is a planning, forecasting, supply-chain, scenario, or data question:
  → Use JSON MODE rules below.

JSON MODE RULES (only for domain questions):
1. Respond as strict JSON ONLY (no markdown, no prose outside JSON, no code fences).
2. The first line must still be [VISUAL:TYPE], then a blank line, then JSON.
3. Use this exact JSON shape:
{
  "response_type": "analysis",
  "title": "short title",
  "situation": "1 short sentence",
  "impact": [
    { "label": "metric name", "value": "number with unit", "detail": "short meaning" },
    { "label": "metric name", "value": "number with unit", "detail": "short meaning" }
  ],
  "actions": [
    { "step": 1, "timeframe": "Week X", "action": "clear action" },
    { "step": 2, "timeframe": "Week X", "action": "clear action" },
    { "step": 3, "timeframe": "Week X", "action": "clear action" }
  ],
  "risk": "1 short sentence",
  "kpis": {
    "forecast_12w_avg": "value",
    "production_commit": "value",
    "gap_vs_target": "value"
  },
  "visual": {
    "title": "short chart title",
    "type": "bar_range | bar",
    "unit": "units/wk | days | %",
    "baseline": { "label": "commit | target | base", "value": 0 },
    "data": [
      { "label": "W1", "value": 0, "low": 0, "high": 0 },
      { "label": "W2", "value": 0, "low": 0, "high": 0 }
    ]
  }
}
4. Keep output concise and decision-ready.
5. Always use numbers from session data.
6. For PMI what-if, apply +0.8% demand per PMI point above base (or negative below base).
7. For greetings/off-topic, DO NOT use JSON — return simple natural text.
8. Never say "I don't have enough data".
9. Tone: professional and calm.

VISUAL DATA RULES (MANDATORY for domain questions):
- Always include the "visual" object with numeric data the UI can chart.
- Match the visual to the [VISUAL:TYPE] tag:
  * DEMAND_TREND → 6–8 weekly points with low/high range; baseline = production_commit.
  * SCENARIO_COMPARE → 3 bars for Bull/Base/Bear with value = peak_demand; baseline = production_commit.
  * PMI_SENSITIVITY → 2 bars (Base vs Target) with value = demand; baseline optional.
  * INVENTORY → 2 bars (Backlog vs Target cover) with value = days.
  * FREIGHT → 1–3 bars (Index + MoM) with value = index or %.
  * CANCEL_RATE → 1–3 bars (Bull/Base/Bear) with value = cancel rate %.
- Use realistic labels ("W1", "W2" or "Bull", "Base", "Bear").
- Keep values numeric (no units in numbers). Units go in "unit".

REPORT MODE RULES (ONLY when user explicitly asks for a report):
1. Return JSON with "response_type": "report".
2. Include keys: executive_summary, kpi_snapshot, scenario_comparison, key_risks, action_plan_30_60_90, final_recommendation.
3. scenario_comparison must be an array of objects with keys: scenario, peak_demand, production_commit, gap_vs_commit, suggested_stance.
4. Keep report brief and decision-ready.
5. Keep tone executive and practical.

IMPORTANT: Do NOT use report mode unless the user explicitly says "report", "summary report", "download report", or "generate report". For all other questions, use analysis JSON.

━━━ VISUAL DIRECTIVE (MANDATORY — EVERY RESPONSE) ━━━

The VERY FIRST line of your response must be exactly one of these visual tags.
Output the tag alone on its own line, then a blank line, then your answer text.
The tag drives a live chart in the UI — choose based on the question's primary intent:

[VISUAL:NONE]            → greeting, pleasantry, thanks, off-topic, "what can you do"
[VISUAL:PMI_SENSITIVITY] → any question about PMI changing, PMI sensitivity, "what if PMI is X"
[VISUAL:SCENARIO_COMPARE]→ compare scenarios, bull vs base vs bear, risk comparison, shortfall, report requests
[VISUAL:DEMAND_TREND]    → weekly forecast, demand outlook, production volume, profit, "how is demand"
[VISUAL:INVENTORY]       → backlog days, inventory cover, buffer, days-of-supply, stock
[VISUAL:FREIGHT]         → freight index, logistics, supply chain capacity, freight MoM
[VISUAL:CANCEL_RATE]     → cancel rate, order cancellations, demand reversal

Format of every response:
[VISUAL:TYPE]

<your answer here>

Examples:
- "hi" → first line is [VISUAL:NONE]
- "what if PMI drops to 45?" → first line is [VISUAL:PMI_SENSITIVITY]
- "compare all 3 scenarios" → first line is [VISUAL:SCENARIO_COMPARE]
- "what's my week 1 forecast?" → first line is [VISUAL:DEMAND_TREND]
- "how much inventory buffer?" → first line is [VISUAL:INVENTORY]
- "freight trending?" → first line is [VISUAL:FREIGHT]
- "is cancel rate a problem?" → first line is [VISUAL:CANCEL_RATE]
- "should I increase production in bull?" → first line is [VISUAL:DEMAND_TREND]
- "what signals to watch?" → first line is [VISUAL:SCENARIO_COMPARE]

Do NOT omit this tag. Do NOT put any other text on the first line.`;
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
