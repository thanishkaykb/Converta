import { Link } from "@tanstack/react-router";
import type { Tool } from "@/lib/tools";
import { cn } from "@/lib/utils";

const CAT_BG: Record<string, string> = {
  pdf: "bg-[color:var(--pdf)]/15 text-[color:var(--pdf)]",
  image: "bg-[color:var(--image)]/15 text-[color:var(--image)]",
  ai: "bg-[color:var(--ai)]/15 text-[color:var(--ai)]",
  convert: "bg-[color:var(--convert)]/15 text-[color:var(--convert)]",
};

const CAT_GLOW: Record<string, string> = {
  pdf: "hover:shadow-[var(--shadow-glow-pdf)]",
  image: "hover:shadow-[var(--shadow-glow-image)]",
  ai: "hover:shadow-[var(--shadow-glow-ai)]",
  convert: "hover:shadow-[var(--shadow-glow-violet)]",
};

export function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  const inner = (
    <div className={cn(
      "group relative h-full rounded-xl border border-border/60 bg-card p-5 transition-all duration-300",
      "hover:-translate-y-1 hover:border-border",
      CAT_GLOW[tool.category],
    )}>
      <div className={cn("inline-grid h-11 w-11 place-items-center rounded-lg mb-4", CAT_BG[tool.category])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-display font-semibold text-base mb-1 flex items-center gap-2">
        {tool.name}
        {!tool.implemented && (
          <span className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-muted text-muted-foreground">soon</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{tool.description}</p>
    </div>
  );

  return (
    <Link to="/tools/$slug" params={{ slug: tool.slug }} className="block h-full">
      {inner}
    </Link>
  );
}
