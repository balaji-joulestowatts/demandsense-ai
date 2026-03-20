import { Info } from "lucide-react";

interface InfoTooltipProps {
  description: string;
}

export default function InfoTooltip({ description }: InfoTooltipProps) {
  return (
    <div className="group relative inline-flex items-center ml-1.5 flex-shrink-0 align-middle">
      <button
        type="button"
        className="cursor-help inline-flex focus:outline-none text-[hsl(var(--ds-text-tertiary))] hover:text-[hsl(var(--ds-text-primary))] transition-colors"
        aria-label="More information"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <div 
        className="absolute z-[9999] bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[320px] 
                   opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200
                   border rounded-lg p-3 text-xs leading-relaxed shadow-xl translate-y-1 group-hover:translate-y-0
                   pointer-events-none"
        style={{
          background: "hsl(var(--card))",
          borderColor: "hsl(var(--ds-border-subtle))",
          color: "hsl(var(--ds-text-secondary))",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        }}
      >
        {description}
        {/* Downward triangle indicator */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-solid border-t-[6px] border-x-[6px] border-b-0 border-transparent w-0 h-0"
             style={{ borderTopColor: "hsl(var(--card))", WebkitFilter: "drop-shadow(0 1px 1px rgba(0,0,0,0.1))" }} />
      </div>
    </div>
  );
}
