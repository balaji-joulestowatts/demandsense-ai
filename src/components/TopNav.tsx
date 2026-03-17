import { BarChart3 } from "lucide-react";
import { ALL_SKUS, type SKUData } from "@/data/forecastData";

interface TopNavProps {
  selectedSkuId: string;
  onSkuChange: (id: string) => void;
}

export default function TopNav({ selectedSkuId, onSkuChange }: TopNavProps) {
  return (
    <nav className="h-14 bg-card border-b flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="bg-primary text-primary-foreground p-1 rounded-md">
           <BarChart3 className="w-4 h-4" />
        </div>
        <span className="font-semibold text-foreground tracking-tight text-[15px]">
          DemandSense
        </span>
        <span className="hidden sm:inline-flex text-[10px] font-medium uppercase tracking-widest text-muted-foreground ml-2">
          Prediction Studio
        </span>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={selectedSkuId}
          onChange={(e) => onSkuChange(e.target.value)}
          className="bg-secondary/50 border-none text-foreground font-medium rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring ds-transition min-w-[280px] shadow-sm hover:bg-secondary/80 cursor-pointer"
        >
          {ALL_SKUS.map((sku: SKUData) => (
            <option key={sku.id} value={sku.id}>
              {sku.name} — {sku.category}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden md:flex items-center gap-4">
        <span className="inline-flex items-center bg-secondary/50 text-muted-foreground rounded-md px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase">
          ML Ensemble · GBM + LSTM
        </span>
        <span className="text-muted-foreground text-[11px] uppercase tracking-wider font-medium">
          Last updated: 17 Mar 2026
        </span>
      </div>
    </nav>
  );
}
