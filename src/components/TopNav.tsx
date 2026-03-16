import { BarChart3 } from "lucide-react";
import { ALL_SKUS, type SKUData } from "@/data/forecastData";

interface TopNavProps {
  selectedSkuId: string;
  onSkuChange: (id: string) => void;
}

export default function TopNav({ selectedSkuId, onSkuChange }: TopNavProps) {
  return (
    <nav className="h-16 bg-[hsl(var(--ds-nav))] border-b border-white/10 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 backdrop-blur">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-ds-nav-foreground" />
        <span className="font-bold text-ds-nav-foreground tracking-display text-lg">
          DemandSense
        </span>
        <span className="hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-widest rounded-full bg-white/10 text-[#bfdbfe] px-2 py-0.5 border border-white/10">
          Prediction Studio
        </span>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={selectedSkuId}
          onChange={(e) => onSkuChange(e.target.value)}
          className="bg-[#0b1730] border border-[#334155] text-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ds-base ds-transition min-w-[320px]"
        >
          {ALL_SKUS.map((sku: SKUData) => (
            <option key={sku.id} value={sku.id}>
              {sku.name} — {sku.category}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden md:flex items-center gap-4">
        <span className="inline-flex items-center bg-[#0b1730] border border-[#334155] text-[#94a3b8] rounded-full px-3 py-1 font-mono text-[10px] tracking-wider uppercase">
          ML Ensemble · GBM + LSTM
        </span>
        <span className="text-[#94a3b8] text-xs">
          Last updated: 16 Mar 2026
        </span>
      </div>
    </nav>
  );
}
