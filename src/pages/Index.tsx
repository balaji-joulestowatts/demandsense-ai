import { useState } from "react";
import { SKU_MAP, ALL_SKUS } from "@/data/forecastData";
import TopNav from "@/components/TopNav";
import SignalMonitor from "@/components/SignalMonitor";
import ForecastPanel from "@/components/ForecastPanel";
import PlannerPanel from "@/components/PlannerPanel";
import AccuracyBanner from "@/components/AccuracyBanner";
import AIAdvisor from "@/components/AIAdvisor";
import PredictionOverview from "@/components/PredictionOverview";

export default function Index() {
  const [selectedSkuId, setSelectedSkuId] = useState(ALL_SKUS[0].id);
  const [activeScenario, setActiveScenario] = useState<"bull" | "base" | "bear">("base");
  const [transitioning, setTransitioning] = useState(false);

  const sku = SKU_MAP[selectedSkuId];

  const handleSkuChange = (id: string) => {
    setTransitioning(true);
    setTimeout(() => {
      setSelectedSkuId(id);
      setTimeout(() => setTransitioning(false), 50);
    }, 150);
  };

  return (
    <div className="min-h-screen prediction-bg flex flex-col">
      <TopNav selectedSkuId={selectedSkuId} onSkuChange={handleSkuChange} />

      <main
        className="flex-1 w-full max-w-[1480px] mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-6 ds-transition"
        style={{ opacity: transitioning ? 0 : 1 }}
      >
        <PredictionOverview sku={sku} activeScenario={activeScenario} />
        <SignalMonitor sku={sku} activeScenario={activeScenario} onScenarioChange={setActiveScenario} />
        <ForecastPanel sku={sku} />
        <PlannerPanel sku={sku} activeScenario={activeScenario} />
        <AccuracyBanner sku={sku} />
      </main>

      <footer className="text-center py-4 text-xs text-ds-text-tertiary">
        Powered by ML Ensemble (GBM + LSTM) · Demand Forecasting POC
      </footer>

      <AIAdvisor sku={sku} activeScenario={activeScenario} />
    </div>
  );
}
