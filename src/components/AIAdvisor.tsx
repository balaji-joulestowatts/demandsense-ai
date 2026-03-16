import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, X, Trash2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { type SKUData } from "@/data/forecastData";
import { type AdvisorMessage, type AdvisorContext, streamAdvisor } from "@/lib/advisorApi";
import clsx from "clsx";
import { toast } from "sonner";

interface AIAdvisorProps {
  sku: SKUData;
  activeScenario: "bull" | "base" | "bear";
  currentSliders?: {
    pmi: number;
    freight_index: number;
    backlog_days: number;
    cancel_rate: number;
  };
}

const SUGGESTED = [
  "How do I increase profit next month?",
  "What if PMI drops to 45?",
  "Should I increase production in the bull scenario?",
  "What's the best procurement strategy right now?",
  "How much inventory buffer do I need for the bear case?",
  "Compare my risk across all 3 scenarios",
  "What signals should I watch to switch from base to bull?",
  "PMI is at 5 — what's the damage?",
];

const SCENARIO_COLORS: Record<string, string> = {
  bull: "bg-emerald-100 text-emerald-700",
  base: "bg-blue-100 text-blue-700",
  bear: "bg-amber-100 text-amber-700",
};

export default function AIAdvisor({ sku, activeScenario, currentSliders }: AIAdvisorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevContextRef = useRef({ skuId: sku.id, scenario: activeScenario });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Context change detection
  useEffect(() => {
    const prev = prevContextRef.current;
    if (isOpen && (prev.skuId !== sku.id || prev.scenario !== activeScenario)) {
      const sysMsg: AdvisorMessage = {
        role: "system",
        content: `Context updated to ${sku.name} — ${activeScenario} scenario`,
      };
      setMessages((m) => [...m, sysMsg]);
    }
    prevContextRef.current = { skuId: sku.id, scenario: activeScenario };
  }, [sku.id, activeScenario, isOpen, sku.name]);

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg: AdvisorMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";

    const ctx: AdvisorContext = {
      sku,
      activeScenario,
      currentSliders,
    };

    const allMessages = [...messages.filter((m) => m.role !== "system"), userMsg];

    try {
      await streamAdvisor({
        messages: allMessages,
        ctx,
        onDelta: (chunk) => {
          assistantSoFar += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
              );
            }
            return [...prev, { role: "assistant", content: assistantSoFar }];
          });
        },
        onDone: () => setLoading(false),
        onError: (err) => {
          toast.error(err);
          setLoading(false);
        },
      });
    } catch {
      toast.error("Failed to reach advisor. Please try again.");
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoResize = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-5 py-3 shadow-lg transition-all duration-300",
          "bg-[hsl(var(--ds-nav))] text-[hsl(var(--ds-nav-foreground))] hover:scale-105",
          isOpen && "scale-0 opacity-0 pointer-events-none"
        )}
      >
        <Bot className="h-5 w-5" />
        <span className="text-sm font-medium">Ask AI</span>
      </button>

      {/* Panel */}
      <div
        className={clsx(
          "fixed z-50 transition-all duration-300 ease-out",
          // Desktop: right drawer
          "bottom-0 right-0 top-0 w-full sm:w-[480px]",
          // Mobile: full width
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-full flex-col bg-[hsl(var(--background))] border-l border-[hsl(var(--ds-border-subtle))] shadow-[-20px_0_50px_rgba(0,0,0,0.1)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[hsl(var(--ds-border-subtle))] px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--ds-nav))]">
                <Sparkles className="h-4 w-4 text-[hsl(var(--ds-nav-foreground))]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[hsl(var(--ds-text-primary))]">
                  DemandSense AI Advisor
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                    Powered by AI
                  </span>
                  <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded", SCENARIO_COLORS[activeScenario])}>
                    {activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="p-2 rounded-lg text-[hsl(var(--ds-text-tertiary))] hover:bg-[hsl(var(--muted))] transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg text-[hsl(var(--ds-text-tertiary))] hover:bg-[hsl(var(--muted))] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <>
                <div className="rounded-2xl rounded-tl-sm bg-[hsl(var(--muted))] border border-[hsl(var(--ds-border-subtle))] px-4 py-3 text-sm text-[hsl(var(--ds-text-secondary))] max-w-[92%]">
                  Hi! I'm your AI planning advisor. I have full visibility into your{" "}
                  <strong>{sku.name}</strong> forecast data across Bull, Base, and Bear scenarios.
                  Ask me anything about demand, profit levers, or risk management.
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="text-xs px-3 py-1.5 rounded-full border border-[hsl(var(--ds-border-subtle))] text-[hsl(var(--ds-text-secondary))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--ds-text-primary))] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((msg, i) => {
              if (msg.role === "system") {
                return (
                  <div key={i} className="text-center text-xs italic text-[hsl(var(--ds-text-tertiary))] py-1">
                    {msg.content}
                  </div>
                );
              }
              if (msg.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="bg-[hsl(var(--ds-nav))] text-[hsl(var(--ds-nav-foreground))] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[85%]">
                      {msg.content}
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} className="flex justify-start">
                  <div className="bg-[hsl(var(--muted))] border border-[hsl(var(--ds-border-subtle))] rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[92%] prose prose-sm prose-slate max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              );
            })}

            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-[hsl(var(--muted))] border border-[hsl(var(--ds-border-subtle))] rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[hsl(var(--ds-text-tertiary))] animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-[hsl(var(--ds-text-tertiary))] animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-[hsl(var(--ds-text-tertiary))] animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[hsl(var(--ds-border-subtle))] p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoResize();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about scenarios, profit, risk..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-[hsl(var(--ds-border-subtle))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--ds-text-primary))] placeholder:text-[hsl(var(--ds-text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent"
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className={clsx(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                  input.trim() && !loading
                    ? "bg-[hsl(var(--ds-nav))] text-[hsl(var(--ds-nav-foreground))] hover:opacity-90"
                    : "bg-[hsl(var(--muted))] text-[hsl(var(--ds-text-tertiary))] cursor-not-allowed"
                )}
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
