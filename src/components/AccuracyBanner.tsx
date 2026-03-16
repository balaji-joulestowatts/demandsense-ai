import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { type SKUData } from "@/data/forecastData";
import clsx from "clsx";

interface AccuracyBannerProps {
  sku: SKUData;
}

export default function AccuracyBanner({ sku }: AccuracyBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const acc = sku.model_accuracy;

  const avgEnsemble = ((acc.ensemble_mape_1w + acc.ensemble_mape_1m + acc.ensemble_mape_3m) / 3).toFixed(1);
  const avgBaseline = ((acc.baseline_mape_1w + acc.baseline_mape_1m + acc.baseline_mape_3m) / 3).toFixed(1);

  const chartData = [
    { horizon: "1 Week", ensemble: acc.ensemble_mape_1w, baseline: acc.baseline_mape_1w },
    { horizon: "1 Month", ensemble: acc.ensemble_mape_1m, baseline: acc.baseline_mape_1m },
    { horizon: "3 Month", ensemble: acc.ensemble_mape_3m, baseline: acc.baseline_mape_3m },
  ];

  return (
    <section className="ds-section-card p-5">
      {/* Collapsed row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            ML Ensemble MAPE: <strong className="text-ds-positive">{avgEnsemble}%</strong> avg
          </span>
          <span className="text-ds-text-tertiary">vs</span>
          <span className="text-ds-text-secondary line-through">
            Traditional Baseline: {avgBaseline}%
          </span>
          <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#059669]">
            ↓ {acc.overall_improvement_pct}% improvement
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-ds-text-secondary hover:text-ds-text-primary ds-transition"
        >
          {expanded ? "Hide" : "Show accuracy breakdown"}
          <ChevronDown className={clsx("w-3.5 h-3.5 ds-transition", expanded && "rotate-180")} />
        </button>
      </div>

      {/* Expanded */}
      <div
        className="overflow-hidden ds-transition"
        style={{ maxHeight: expanded ? "300px" : "0", opacity: expanded ? 1 : 0, marginTop: expanded ? "16px" : "0" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chart */}
          <div>
            <p className="text-xs text-ds-text-secondary mb-2 font-medium">MAPE by forecast horizon (lower is better)</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="horizon" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 35]} unit="%" />
                <Bar dataKey="ensemble" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {chartData.map((_, i) => <Cell key={i} fill="#2563eb" />)}
                </Bar>
                <Bar dataKey="baseline" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {chartData.map((_, i) => <Cell key={i} fill="#cbd5e1" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-[11px] text-ds-text-secondary">
                <span className="w-3 h-2 rounded-sm bg-ds-base" /> ML Ensemble
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-ds-text-secondary">
                <span className="w-3 h-2 rounded-sm bg-[#cbd5e1]" /> Baseline
              </span>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-2 text-sm">
            <p className="text-ds-text-secondary">Last retrain: <span className="text-ds-text-primary font-medium">{new Date(acc.last_retrain).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></p>
            <p className="text-ds-text-secondary">Next retrain: <span className="text-ds-text-primary font-medium">{new Date(acc.next_retrain).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></p>
            <p className="text-ds-text-secondary">Overall improvement: <strong className="text-ds-positive">{acc.overall_improvement_pct}%</strong></p>
            <p className="text-[11px] text-ds-text-tertiary italic leading-relaxed mt-3">
              Model combines Gradient Boosting (tabular signals) + LSTM (temporal sequences). Ensemble weights updated each retrain cycle.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
