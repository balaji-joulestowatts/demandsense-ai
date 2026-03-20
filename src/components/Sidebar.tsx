import {
  BarChart3, LayoutDashboard, TrendingUp, Activity,
  Package, ClipboardList, FileText, Settings, HelpCircle,
} from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  { id: "dashboard",  label: "Dashboard",     icon: LayoutDashboard },
  { id: "forecast",   label: "Forecasts",     icon: TrendingUp },
  { id: "signals",    label: "Signals",        icon: Activity },
  { id: "inventory",  label: "Inventory",      icon: Package },
  { id: "planner",    label: "Supply Planner", icon: ClipboardList },
  { id: "reports",    label: "Reports",        icon: FileText },
];

const BOTTOM_ITEMS = [
  { id: "settings", label: "Settings",    icon: Settings },
  { id: "help",     label: "Help Center", icon: HelpCircle },
];

interface SidebarProps {
  activeNav: string;
  onNavChange: (id: string) => void;
}

export default function Sidebar({ activeNav, onNavChange }: SidebarProps) {
  return (
    <aside
      className="ds-sidebar hidden lg:flex flex-col w-[220px] shrink-0 h-screen sticky top-0"
      style={{ background: "hsl(var(--sidebar-background))", color: "hsl(var(--sidebar-foreground))" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5" style={{ borderBottom: "1px solid hsl(var(--sidebar-border))" }}>
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: "hsl(var(--sidebar-primary) / 0.2)" }}
        >
          <BarChart3 className="w-4 h-4" style={{ color: "hsl(var(--sidebar-primary))" }} />
        </div>
        <div>
          <p className="font-bold text-[14px] leading-tight tracking-tight" style={{ color: "hsl(var(--sidebar-foreground))" }}>DemandSense</p>
          <p className="text-[9px] font-semibold uppercase tracking-widest leading-none mt-0.5" style={{ color: "hsl(var(--sidebar-foreground) / 0.55)" }}>AI Studio</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              className={clsx(
                "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left overflow-hidden",
                isActive
                  ? ""
                  : "hover:bg-[hsl(var(--sidebar-accent))]"
              )}
              style={
                isActive
                  ? { background: "hsl(var(--sidebar-accent))", color: "hsl(var(--sidebar-foreground))" }
                  : { color: "hsl(var(--sidebar-foreground) / 0.7)" }
              }
            >
              {/* Teal left border for active */}
              {isActive && (
                <span
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                  style={{ background: "hsl(var(--sidebar-primary))" }}
                />
              )}
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: isActive ? "hsl(var(--sidebar-primary))" : "currentColor" }}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="px-2.5 pb-4 pt-3 space-y-0.5" style={{ borderTop: "1px solid hsl(var(--sidebar-border))" }}>
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left"
              style={{ color: "hsl(var(--sidebar-foreground) / 0.55)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "hsl(var(--sidebar-foreground))"; e.currentTarget.style.background = "hsl(var(--sidebar-accent))"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "hsl(var(--sidebar-foreground) / 0.55)"; e.currentTarget.style.background = "transparent"; }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* User */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 mt-1.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: "hsl(var(--sidebar-primary) / 0.2)", color: "hsl(var(--sidebar-primary))" }}
          >
            DS
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold leading-tight truncate" style={{ color: "hsl(var(--sidebar-foreground))" }}>Admin</p>
            <p className="text-[10px] leading-tight truncate" style={{ color: "hsl(var(--sidebar-foreground) / 0.5)" }}>admin@ds.ai</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
