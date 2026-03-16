import { useState } from "react";
import { SKU_MAP, ALL_SKUS } from "@/data/forecastData";
import TopNav from "@/components/TopNav";
import SignalMonitor from "@/components/SignalMonitor";
import ForecastPanel from "@/components/ForecastPanel";
import PlannerPanel from "@/components/PlannerPanel";
import AccuracyBanner from "@/components/AccuracyBanner";

export default function Index() {
  const [selectedSkuId, setSelectedSkuId] = useState(ALL_SKUS[0].id);
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
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav selectedSkuId={selectedSkuId} onSkuChange={handleSkuChange} />

      <main
        className="flex-1 w-full max-w-[1400px] mx-auto px-6 py-6 space-y-8 ds-transition"
        style={{ opacity: transitioning ? 0 : 1 }}
      >
        <SignalMonitor sku={sku} />
        <ForecastPanel sku={sku} />
        <PlannerPanel sku={sku} />
        <AccuracyBanner sku={sku} />
      </main>

      <footer className="text-center py-4 text-xs text-ds-text-tertiary">
        Powered by ML Ensemble (GBM + LSTM) · Demand Forecasting POC
      </footer>
    </div>
  );
}
