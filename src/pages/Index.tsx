import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { SKU_MAP, ALL_SKUS } from "@/data/forecastData";
import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import SignalMonitor from "@/components/SignalMonitor";
import ForecastPanel from "@/components/ForecastPanel";
import PlannerPanel from "@/components/PlannerPanel";
import AIAdvisor, { type AIAdvisorHandle } from "@/components/AIAdvisor";
import PredictionOverview from "@/components/PredictionOverview";
import AgentBriefing from "@/components/AgentBriefing";

const SECTION_IDS = ["dashboard", "inventory", "signals", "forecast", "planner", "reports"] as const;

export default function Index() {
  const [selectedSkuId, setSelectedSkuId] = useState(ALL_SKUS[0].id);
  const [activeScenario, setActiveScenario] = useState<"bull" | "base" | "bear">("base");
  const [transitioning, setTransitioning] = useState(false);
  const [activeNav, setActiveNav] = useState("dashboard");
  const advisorRef = useRef<AIAdvisorHandle | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  // One ref per nav section
  const sectionRefs: Record<string, React.RefObject<HTMLDivElement | null>> = {
    dashboard:  useRef<HTMLDivElement>(null),
    inventory:  useRef<HTMLDivElement>(null),
    signals:    useRef<HTMLDivElement>(null),
    forecast:   useRef<HTMLDivElement>(null),
    planner:    useRef<HTMLDivElement>(null),
    reports:    useRef<HTMLDivElement>(null),
  };

  const sku = SKU_MAP[selectedSkuId];

  const handleSkuChange = (id: string) => {
    setTransitioning(true);
    setTimeout(() => {
      setSelectedSkuId(id);
      setTimeout(() => setTransitioning(false), 50);
    }, 150);
  };

  const handleNavChange = (id: string) => {
    setActiveNav(id);
    const ref = sectionRefs[id];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen prediction-bg flex">
      <Sidebar activeNav={activeNav} onNavChange={handleNavChange} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />

        <main
          ref={mainRef}
          className="flex-1 px-4 sm:px-6 py-6 sm:py-8 space-y-6 ds-transition"
          style={{ opacity: transitioning ? 0 : 1 }}
        >
          {/* Page title + action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase font-semibold tracking-widest text-muted-foreground mb-0.5">Prediction Cockpit</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                Demand Forecasting <span className="text-muted-foreground font-normal text-xl">({ALL_SKUS.length})</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/60 bg-card text-sm font-medium text-foreground hover:bg-secondary ds-transition">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Sort by
              </button>
              <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/60 bg-card text-sm font-medium text-foreground hover:bg-secondary ds-transition">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filter by
                <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">4</span>
              </button>
            </div>
          </div>

          {/* SKU Tab strip */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-wrap flex-1">
              {ALL_SKUS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSkuChange(s.id)}
                  className="px-5 py-2 rounded-full text-sm font-medium ds-transition"
                  style={
                    s.id === selectedSkuId
                      ? { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                      : { background: "hsl(var(--card))", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))" }
                  }
                >
                  {s.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button className="w-8 h-8 rounded-full border border-border/60 bg-card flex items-center justify-center hover:bg-secondary ds-transition">
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <button className="w-8 h-8 rounded-full border border-border/60 bg-card flex items-center justify-center hover:bg-secondary ds-transition">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
              <button className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:opacity-90 ds-transition">
                <Plus className="w-4 h-4 text-primary-foreground" />
              </button>
            </div>
          </div>

          {/* ── Dashboard / Overview ── */}
          <div ref={sectionRefs.dashboard} style={{ scrollMarginTop: "80px" }}>
            <PredictionOverview sku={sku} activeScenario={activeScenario} />
          </div>

          {/* ── Inventory & Supply Briefing ── */}
          <div ref={sectionRefs.inventory} style={{ scrollMarginTop: "80px" }}>
            <AgentBriefing sku={sku} activeScenario={activeScenario} advisorRef={advisorRef} />
          </div>

          {/* ── Signals ── */}
          <div ref={sectionRefs.signals} style={{ scrollMarginTop: "80px" }}>
            <SignalMonitor sku={sku} activeScenario={activeScenario} onScenarioChange={setActiveScenario} />
          </div>

          {/* ── Forecast Chart ── */}
          <div ref={sectionRefs.forecast} style={{ scrollMarginTop: "80px" }}>
            <ForecastPanel sku={sku} />
          </div>

          {/* ── Supply Planner ── */}
          <div ref={sectionRefs.planner} style={{ scrollMarginTop: "80px" }}>
            <PlannerPanel sku={sku} activeScenario={activeScenario} />
          </div>

          {/* ── Reports / Accuracy ── */}
          <div ref={sectionRefs.reports} style={{ scrollMarginTop: "80px" }} />
        </main>

        <footer className="text-center py-3 text-xs text-ds-text-tertiary border-t border-border/40">
          Powered by ML Ensemble (GBM + LSTM) · Demand Forecasting POC
        </footer>
      </div>

      <AIAdvisor ref={advisorRef} sku={sku} activeScenario={activeScenario} />
    </div>
  );
}
