import { BarChart3 } from "lucide-react";
import { ALL_SKUS, type SKUData } from "@/data/forecastData";

interface TopNavProps {
  selectedSkuId: string;
  onSkuChange: (id: string) => void;
}

export default function TopNav({ selectedSkuId, onSkuChange }: TopNavProps) {
  return (
    <nav className="h-14 bg-ds-nav flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-ds-nav-foreground" />
        <span className="font-bold text-ds-nav-foreground tracking-display text-lg">
          DemandSense
        </span>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={selectedSkuId}
          onChange={(e) => onSkuChange(e.target.value)}
          className="bg-[#1e293b] border border-[#334155] text-[#e2e8f0] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ds-base ds-transition"
        >
          {ALL_SKUS.map((sku: SKUData) => (
            <option key={sku.id} value={sku.id}>
              {sku.name} — {sku.category}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden md:flex items-center gap-4">
        <span className="inline-flex items-center bg-[#1e293b] border border-[#334155] text-[#94a3b8] rounded-full px-3 py-1 font-mono text-[10px] tracking-wider uppercase">
          ML Ensemble · GBM + LSTM
        </span>
        <span className="text-[#64748b] text-xs">
          Last updated: 16 Mar 2026
        </span>
      </div>
    </nav>
  );
}
