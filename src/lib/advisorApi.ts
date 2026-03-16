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

1. Always cite specific numbers from the data above.
2. When asked about profit/revenue: frame in terms of demand volume × margin levers.
3. When asked "what if PMI goes to X": compute the directional impact using +0.8% demand per PMI point above base, show the new demand estimate, then give 3 specific actions.
4. Structure answers as:
   → Situation: 1 sentence quantifying the scenario
   → Impact: what this means in numbers
   → Actions: numbered list of 3–5 specific, time-bound actions
   → Risk: 1 sentence on what to watch
5. Keep answers under 250 words unless the question explicitly asks for a full analysis.
6. Never say "I don't have enough data" — always reason from the data provided.
7. Use markdown formatting for clarity: bold for key numbers, bullet lists for actions.`;
}

const ADVISOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/advisor`;

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
  const systemPrompt = buildSystemPrompt(ctx);

  const resp = await fetch(ADVISOR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      systemPrompt,
    }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    onError(data.error || `Request failed (${resp.status})`);
    return;
  }

  if (!resp.body) {
    onError("No response stream");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        onDone();
        return;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  onDone();
}
