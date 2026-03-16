// ============================================================
// DemandSense POC — Mock Data File
// Replace this with a real API call to your ML model endpoint
// when moving from POC to production.
// ============================================================

export type WeeklyForecast = {
  week: number;
  label: string;
  demand: number;
  lower: number;
  upper: number;
};

export type HistoricalPoint = {
  week: number;
  label: string;
  actual: number;
  baseline: number; // what traditional stat model would have predicted
};

export type ScenarioSignals = {
  pmi: number;
  pmi_trend: "up" | "down" | "flat";
  freight_index: number;
  freight_mom_pct: number;
  backlog_days: number;
  cancel_rate: number;
  fx_index: number;
};

export type PlannerOutputs = {
  production_commit: number;
  inventory_target_days: number;
  procurement_week: number;
  alignment_confidence: number;
  action_status: "ACT NOW" | "WATCH" | "HOLD";
  action_color: "red" | "amber" | "green";
};

export type Scenario = {
  id: "bull" | "base" | "bear";
  label: string;
  description: string;
  assumption: string;
  peak_demand: number;
  color: string;
  tailwind_color: string;
  signals: ScenarioSignals;
  forecast: WeeklyForecast[];
  planner: PlannerOutputs;
};

export type SKUData = {
  id: string;
  name: string;
  unit: string;
  category: string;
  historical: HistoricalPoint[];
  scenarios: {
    bull: Scenario;
    base: Scenario;
    bear: Scenario;
  };
  model_accuracy: {
    ensemble_mape_1w: number;
    ensemble_mape_1m: number;
    ensemble_mape_3m: number;
    baseline_mape_1w: number;
    baseline_mape_1m: number;
    baseline_mape_3m: number;
    last_retrain: string;
    next_retrain: string;
    overall_improvement_pct: number;
  };
};

// ─── Utility: generate date labels (Mon DD) going backwards then forward ───
function weekLabel(offsetFromToday: number): string {
  const d = new Date("2026-03-16");
  d.setDate(d.getDate() + offsetFromToday * 7);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

// ─── Historical: 26 weeks of actuals ───────────────────────────────────────
function buildHistorical(
  baseDemand: number,
  volatility: number,
  seed: number
): HistoricalPoint[] {
  const history: HistoricalPoint[] = [];
  let val = baseDemand;
  for (let i = -26; i <= 0; i++) {
    const noise = Math.sin(i * 0.7 + seed) * volatility + Math.cos(i * 1.3 + seed) * (volatility * 0.5);
    const seasonal = Math.sin((i / 52) * 2 * Math.PI) * (baseDemand * 0.08);
    val = Math.round(baseDemand + noise + seasonal);
    const baselineMiss = Math.round(noise * 1.4 + seasonal * 0.6); // stat model is less accurate
    history.push({
      week: i,
      label: weekLabel(i),
      actual: Math.max(val, 100),
      baseline: Math.max(val + baselineMiss, 80),
    });
  }
  return history;
}

// ─── Forecast: 52 weeks forward for a given scenario multiplier ───────────
function buildForecast(
  baseDemand: number,
  multiplier: number,
  volatility: number,
  seed: number,
  confidenceWidth: number
): WeeklyForecast[] {
  const forecast: WeeklyForecast[] = [];
  for (let w = 1; w <= 52; w++) {
    const trend = 1 + (multiplier - 1) * Math.min(w / 26, 1); // ramp in multiplier
    const seasonal = Math.sin((w / 52) * 2 * Math.PI) * (baseDemand * 0.07);
    const noise = Math.sin(w * 0.9 + seed) * (volatility * 0.4);
    const demand = Math.round(baseDemand * trend + seasonal + noise);
    const bandExpansion = 1 + w * 0.015; // confidence bands widen with horizon
    const lower = Math.round(demand - confidenceWidth * bandExpansion);
    const upper = Math.round(demand + confidenceWidth * bandExpansion);
    forecast.push({
      week: w,
      label: weekLabel(w),
      demand: Math.max(demand, 100),
      lower: Math.max(lower, 60),
      upper,
    });
  }
  return forecast;
}

// ════════════════════════════════════════════════════════════
// SKU 1 — Electronics-A (Consumer electronics components)
// ════════════════════════════════════════════════════════════
const electronicsA: SKUData = {
  id: "electronics-a",
  name: "Electronics-A",
  unit: "units",
  category: "Consumer Electronics Components",
  historical: buildHistorical(1100, 85, 1.2),
  model_accuracy: {
    ensemble_mape_1w: 4.2,
    ensemble_mape_1m: 7.8,
    ensemble_mape_3m: 12.1,
    baseline_mape_1w: 6.9,
    baseline_mape_1m: 14.3,
    baseline_mape_3m: 23.6,
    last_retrain: "2026-03-01",
    next_retrain: "2026-04-01",
    overall_improvement_pct: 18.4,
  },
  scenarios: {
    bull: {
      id: "bull",
      label: "Bull",
      description: "Strong demand expansion with tightening freight and accelerating backlogs",
      assumption: "PMI > 54, freight tight, backlog conv +18%",
      peak_demand: 1520,
      color: "#16a34a",
      tailwind_color: "green",
      signals: {
        pmi: 54.8,
        pmi_trend: "up",
        freight_index: 118,
        freight_mom_pct: 6.2,
        backlog_days: 52,
        cancel_rate: 1.8,
        fx_index: 102,
      },
      forecast: buildForecast(1100, 1.28, 60, 1.2, 65),
      planner: {
        production_commit: 1350,
        inventory_target_days: 28,
        procurement_week: 2,
        alignment_confidence: 82,
        action_status: "ACT NOW",
        action_color: "red",
      },
    },
    base: {
      id: "base",
      label: "Base",
      description: "Continuation of current trajectory with stable macro conditions",
      assumption: "PMI 50–52, freight normalising, flat conversion",
      peak_demand: 1210,
      color: "#2563eb",
      tailwind_color: "blue",
      signals: {
        pmi: 51.3,
        pmi_trend: "flat",
        freight_index: 104,
        freight_mom_pct: 1.1,
        backlog_days: 38,
        cancel_rate: 3.2,
        fx_index: 100,
      },
      forecast: buildForecast(1100, 1.08, 60, 2.1, 75),
      planner: {
        production_commit: 1120,
        inventory_target_days: 35,
        procurement_week: 4,
        alignment_confidence: 91,
        action_status: "WATCH",
        action_color: "amber",
      },
    },
    bear: {
      id: "bear",
      label: "Bear",
      description: "Demand contraction driven by macro headwinds and rising cancellations",
      assumption: "PMI < 48, FX headwind, cancel rate +9%",
      peak_demand: 870,
      color: "#d97706",
      tailwind_color: "amber",
      signals: {
        pmi: 47.2,
        pmi_trend: "down",
        freight_index: 91,
        freight_mom_pct: -4.8,
        backlog_days: 22,
        cancel_rate: 9.1,
        fx_index: 94,
      },
      forecast: buildForecast(1100, 0.82, 60, 3.3, 90),
      planner: {
        production_commit: 880,
        inventory_target_days: 48,
        procurement_week: 8,
        alignment_confidence: 68,
        action_status: "HOLD",
        action_color: "green",
      },
    },
  },
};

// ════════════════════════════════════════════════════════════
// SKU 2 — Components-B (Industrial sub-assemblies)
// ════════════════════════════════════════════════════════════
const componentsB: SKUData = {
  id: "components-b",
  name: "Components-B",
  unit: "units",
  category: "Industrial Sub-assemblies",
  historical: buildHistorical(740, 55, 2.5),
  model_accuracy: {
    ensemble_mape_1w: 3.8,
    ensemble_mape_1m: 8.9,
    ensemble_mape_3m: 14.7,
    baseline_mape_1w: 7.2,
    baseline_mape_1m: 16.8,
    baseline_mape_3m: 27.4,
    last_retrain: "2026-02-15",
    next_retrain: "2026-03-29",
    overall_improvement_pct: 21.2,
  },
  scenarios: {
    bull: {
      id: "bull",
      label: "Bull",
      description: "Capex cycle acceleration driving industrial component demand surge",
      assumption: "PMI > 55, capex unlocking, lead time compressing",
      peak_demand: 1020,
      color: "#16a34a",
      tailwind_color: "green",
      signals: {
        pmi: 55.6,
        pmi_trend: "up",
        freight_index: 122,
        freight_mom_pct: 8.1,
        backlog_days: 58,
        cancel_rate: 1.2,
        fx_index: 105,
      },
      forecast: buildForecast(740, 1.32, 42, 4.1, 48),
      planner: {
        production_commit: 920,
        inventory_target_days: 22,
        procurement_week: 1,
        alignment_confidence: 79,
        action_status: "ACT NOW",
        action_color: "red",
      },
    },
    base: {
      id: "base",
      label: "Base",
      description: "Steady industrial demand with modest capex recovery underway",
      assumption: "PMI 50–53, steady capex, moderate lead times",
      peak_demand: 810,
      color: "#2563eb",
      tailwind_color: "blue",
      signals: {
        pmi: 51.9,
        pmi_trend: "up",
        freight_index: 106,
        freight_mom_pct: 2.3,
        backlog_days: 41,
        cancel_rate: 2.9,
        fx_index: 100,
      },
      forecast: buildForecast(740, 1.09, 42, 5.2, 55),
      planner: {
        production_commit: 760,
        inventory_target_days: 32,
        procurement_week: 3,
        alignment_confidence: 88,
        action_status: "WATCH",
        action_color: "amber",
      },
    },
    bear: {
      id: "bear",
      label: "Bear",
      description: "Capex freeze and destocking wave suppresses component pull-through",
      assumption: "PMI < 47, capex freeze, destocking -20%",
      peak_demand: 560,
      color: "#d97706",
      tailwind_color: "amber",
      signals: {
        pmi: 46.4,
        pmi_trend: "down",
        freight_index: 88,
        freight_mom_pct: -6.4,
        backlog_days: 18,
        cancel_rate: 11.3,
        fx_index: 92,
      },
      forecast: buildForecast(740, 0.79, 42, 6.3, 72),
      planner: {
        production_commit: 580,
        inventory_target_days: 55,
        procurement_week: 10,
        alignment_confidence: 62,
        action_status: "HOLD",
        action_color: "green",
      },
    },
  },
};

// ════════════════════════════════════════════════════════════
// SKU 3 — Raw Material-C (Bulk commodity inputs)
// ════════════════════════════════════════════════════════════
const rawMaterialC: SKUData = {
  id: "raw-material-c",
  name: "Raw Material-C",
  unit: "MT",
  category: "Bulk Commodity Inputs",
  historical: buildHistorical(320, 28, 3.8),
  model_accuracy: {
    ensemble_mape_1w: 5.1,
    ensemble_mape_1m: 10.2,
    ensemble_mape_3m: 16.8,
    baseline_mape_1w: 8.4,
    baseline_mape_1m: 18.9,
    baseline_mape_3m: 31.2,
    last_retrain: "2026-03-08",
    next_retrain: "2026-04-08",
    overall_improvement_pct: 24.6,
  },
  scenarios: {
    bull: {
      id: "bull",
      label: "Bull",
      description: "Construction and manufacturing boom absorbing bulk raw material stocks",
      assumption: "BDI > 2800, construction PMI > 56, stockpile rebuild",
      peak_demand: 445,
      color: "#16a34a",
      tailwind_color: "green",
      signals: {
        pmi: 56.1,
        pmi_trend: "up",
        freight_index: 128,
        freight_mom_pct: 9.4,
        backlog_days: 62,
        cancel_rate: 0.9,
        fx_index: 108,
      },
      forecast: buildForecast(320, 1.35, 22, 7.1, 30),
      planner: {
        production_commit: 420,
        inventory_target_days: 18,
        procurement_week: 1,
        alignment_confidence: 76,
        action_status: "ACT NOW",
        action_color: "red",
      },
    },
    base: {
      id: "base",
      label: "Base",
      description: "Stable off-take with seasonal restocking supporting volumes",
      assumption: "BDI 2200–2600, construction steady, normal restocking",
      peak_demand: 355,
      color: "#2563eb",
      tailwind_color: "blue",
      signals: {
        pmi: 50.8,
        pmi_trend: "flat",
        freight_index: 103,
        freight_mom_pct: 0.8,
        backlog_days: 35,
        cancel_rate: 3.8,
        fx_index: 100,
      },
      forecast: buildForecast(320, 1.07, 22, 8.2, 36),
      planner: {
        production_commit: 330,
        inventory_target_days: 40,
        procurement_week: 5,
        alignment_confidence: 85,
        action_status: "WATCH",
        action_color: "amber",
      },
    },
    bear: {
      id: "bear",
      label: "Bear",
      description: "Infrastructure slowdown and oversupply create downward price and volume pressure",
      assumption: "BDI < 1800, construction PMI < 46, oversupply +15%",
      peak_demand: 238,
      color: "#d97706",
      tailwind_color: "amber",
      signals: {
        pmi: 45.8,
        pmi_trend: "down",
        freight_index: 86,
        freight_mom_pct: -7.9,
        backlog_days: 15,
        cancel_rate: 13.4,
        fx_index: 90,
      },
      forecast: buildForecast(320, 0.76, 22, 9.3, 48),
      planner: {
        production_commit: 245,
        inventory_target_days: 62,
        procurement_week: 12,
        alignment_confidence: 59,
        action_status: "HOLD",
        action_color: "green",
      },
    },
  },
};

// ════════════════════════════════════════════════════════════
// SKU 4 — Finished Goods-D (Packaged end products)
// ════════════════════════════════════════════════════════════
const finishedGoodsD: SKUData = {
  id: "finished-goods-d",
  name: "Finished Goods-D",
  unit: "units",
  category: "Packaged End Products",
  historical: buildHistorical(2200, 180, 5.9),
  model_accuracy: {
    ensemble_mape_1w: 3.4,
    ensemble_mape_1m: 6.9,
    ensemble_mape_3m: 11.3,
    baseline_mape_1w: 5.8,
    baseline_mape_1m: 13.1,
    baseline_mape_3m: 21.7,
    last_retrain: "2026-03-10",
    next_retrain: "2026-04-10",
    overall_improvement_pct: 16.8,
  },
  scenarios: {
    bull: {
      id: "bull",
      label: "Bull",
      description: "Consumer spending surge and channel restocking amplify end-product demand",
      assumption: "CCI > 108, retail sell-through +12%, channel fill",
      peak_demand: 3050,
      color: "#16a34a",
      tailwind_color: "green",
      signals: {
        pmi: 53.4,
        pmi_trend: "up",
        freight_index: 115,
        freight_mom_pct: 5.6,
        backlog_days: 48,
        cancel_rate: 1.6,
        fx_index: 103,
      },
      forecast: buildForecast(2200, 1.26, 140, 1.5, 145),
      planner: {
        production_commit: 2750,
        inventory_target_days: 24,
        procurement_week: 2,
        alignment_confidence: 84,
        action_status: "ACT NOW",
        action_color: "red",
      },
    },
    base: {
      id: "base",
      label: "Base",
      description: "Steady consumer pull with normal seasonality and moderate channel fill",
      assumption: "CCI 98–105, normal sell-through, stable channel",
      peak_demand: 2380,
      color: "#2563eb",
      tailwind_color: "blue",
      signals: {
        pmi: 51.6,
        pmi_trend: "flat",
        freight_index: 101,
        freight_mom_pct: 0.4,
        backlog_days: 36,
        cancel_rate: 3.5,
        fx_index: 100,
      },
      forecast: buildForecast(2200, 1.06, 140, 2.4, 165),
      planner: {
        production_commit: 2280,
        inventory_target_days: 33,
        procurement_week: 4,
        alignment_confidence: 93,
        action_status: "WATCH",
        action_color: "amber",
      },
    },
    bear: {
      id: "bear",
      label: "Bear",
      description: "Consumer confidence collapse and channel destocking create demand air pocket",
      assumption: "CCI < 88, destocking -18%, discretionary pull-back",
      peak_demand: 1680,
      color: "#d97706",
      tailwind_color: "amber",
      signals: {
        pmi: 47.8,
        pmi_trend: "down",
        freight_index: 89,
        freight_mom_pct: -5.2,
        backlog_days: 21,
        cancel_rate: 10.8,
        fx_index: 93,
      },
      forecast: buildForecast(2200, 0.8, 140, 3.6, 195),
      planner: {
        production_commit: 1720,
        inventory_target_days: 52,
        procurement_week: 9,
        alignment_confidence: 65,
        action_status: "HOLD",
        action_color: "green",
      },
    },
  },
};

// ─── Master export ──────────────────────────────────────────
export const ALL_SKUS: SKUData[] = [
  electronicsA,
  componentsB,
  rawMaterialC,
  finishedGoodsD,
];

export const SKU_MAP: Record<string, SKUData> = {
  "electronics-a": electronicsA,
  "components-b": componentsB,
  "raw-material-c": rawMaterialC,
  "finished-goods-d": finishedGoodsD,
};

// ─── Slider → forecast adjustment function ─────────────────
// Call this when sliders are moved in the UI.
// Returns a multiplier to apply to the base scenario demand values.
export function computeAdjustmentMultiplier(params: {
  pmi: number;
  freightIndex: number;
  backlogDays: number;
  cancelRate: number;
}): number {
  const pmiEffect = (params.pmi - 51) * 0.008;         // +0.8% per PMI point above 51
  const freightEffect = -(params.freightIndex - 104) * 0.004; // cost headwind above 104
  const backlogEffect = (params.backlogDays - 38) * 0.006;    // +0.6% per extra backlog day
  const cancelEffect = -(params.cancelRate - 3.2) * 0.015;    // -1.5% per extra cancel % pt
  return Math.max(0.5, Math.min(1.6, 1 + pmiEffect + freightEffect + backlogEffect + cancelEffect));
}

export default ALL_SKUS;