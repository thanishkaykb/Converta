import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import type { Tool } from "@/lib/tools";

const CAT_BG: Record<string, string> = {
  pdf: "bg-[color:var(--pdf)]/15 text-[color:var(--pdf)]",
  image: "bg-[color:var(--image)]/15 text-[color:var(--image)]",
  ai: "bg-[color:var(--ai)]/15 text-[color:var(--ai)]",
  convert: "bg-[color:var(--convert)]/15 text-[color:var(--convert)]",
};

export function ToolPageShell({ tool, children }: { tool: Tool; children: ReactNode }) {
  const Icon = tool.icon;
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="bg-hero-glow">
          <div className="container mx-auto px-4 pt-10 pb-6">
            <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
              <ChevronLeft className="h-4 w-4 mr-1" /> All tools
            </Link>
            <div className="flex items-start gap-4">
              <div className={`grid h-14 w-14 place-items-center rounded-xl ${CAT_BG[tool.category]}`}>
                <Icon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{tool.name}</h1>
                <p className="text-muted-foreground mt-1 max-w-2xl">{tool.description}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-8 max-w-4xl">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
