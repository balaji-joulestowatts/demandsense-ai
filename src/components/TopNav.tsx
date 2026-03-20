import { Bell, Search, Sun, Moon, Calendar } from "lucide-react";
import { useEffect, useState } from "react";

export default function TopNav() {
  const [dark, setDark] = useState(true);
  const [query, setQuery] = useState("");

  // Initialize theme — default dark unless explicitly set to light
  useEffect(() => {
    const saved = localStorage.getItem("ds-theme");
    const isDark = saved !== "light";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleDark = () => {
    const newDark = !dark;
    setDark(newDark);
    document.documentElement.classList.toggle("dark", newDark);
    localStorage.setItem("ds-theme", newDark ? "dark" : "light");
  };

  return (
    <nav
      className="h-[60px] bg-card border-b border-border/60 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30"
      style={{ boxShadow: "0 1px 3px rgba(40,30,10,0.05)" }}
    >
      {/* Left: search bar */}
      <div className="flex items-center gap-2 bg-secondary/60 rounded-full px-4 py-2 border border-border/50 min-w-[260px] max-w-[380px] w-full">
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find forecasts, signals or reports"
          className="bg-transparent border-none text-foreground text-sm focus:outline-none w-full placeholder:text-muted-foreground"
        />
      </div>

      {/* Right: icons + avatar */}
      <div className="flex items-center gap-1.5 ml-4">
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary ds-transition"
          title="Notifications"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
        </button>

        <button
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary ds-transition"
          title="Calendar"
        >
          <Calendar className="w-4 h-4 text-muted-foreground" />
        </button>

        <button
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary ds-transition"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleDark}
        >
          {dark ? (
            <Sun className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Moon className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border/60">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "hsl(var(--ds-bear))" }}
          >
            DS
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-foreground leading-tight">Admin</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Demand Analyst</p>
          </div>
        </div>
      </div>
    </nav>
  );
}
