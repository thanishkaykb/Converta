import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ToolCard } from "@/components/site/ToolCard";
import { TOOLS, type ToolCategory } from "@/lib/tools";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PixelForge — Every tool for your PDFs & images" },
      { name: "description", content: "Free online PDF and image tools. Merge, split, compress, convert, resize and enhance — all in your browser." },
      { property: "og:title", content: "PixelForge — Every tool for your PDFs & images" },
      { property: "og:description", content: "Free PDF & image tools, processed privately in your browser." },
    ],
  }),
  component: Home,
});

type Filter = "all" | ToolCategory;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All tools" },
  { value: "pdf", label: "PDF" },
  { value: "image", label: "Image" },
  { value: "convert", label: "Convert" },
  { value: "ai", label: "AI / Enhance" },
];

function Home() {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return TOOLS.filter((t) => {
      if (filter !== "all" && t.category !== filter) return false;
      if (query && !`${t.name} ${t.description}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [filter, q]);

  // Group by category for section headings when "all"
  const sections = useMemo(() => {
    if (filter !== "all") return [{ id: filter, title: FILTERS.find(f => f.value === filter)!.label, tools: filtered }];
    const cats: ToolCategory[] = ["pdf", "image", "convert", "ai"];
    return cats.map((c) => ({
      id: c,
      title: FILTERS.find(f => f.value === c)!.label + " Tools",
      tools: filtered.filter((t) => t.category === c),
    })).filter((s) => s.tools.length > 0);
  }, [filtered, filter]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <section className="bg-hero-glow">
        <div className="container mx-auto px-4 pt-16 pb-10 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--image)]" />
            100% private · processed in your browser
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Every tool for your files —<br />
            <span className="text-gradient">in one place.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
            Merge, split, compress, convert, resize and enhance PDFs and images.
            Fast, free, and no size limits.
          </p>

          <div className="mt-8 max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for a tool…"
              className="w-full h-14 pl-12 pr-4 rounded-2xl bg-card border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40 transition"
            />
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="sticky top-16 z-30 border-y border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition border",
                filter === f.value
                  ? "bg-cta text-white border-transparent shadow-[var(--shadow-glow-violet)]"
                  : "bg-card border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tool grid */}
      <main className="container mx-auto px-4 py-12 space-y-14">
        {sections.map((s) => (
          <section key={s.id} id={s.id}>
            <h2 className="font-display text-2xl font-bold mb-6">{s.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {s.tools.map((t) => <ToolCard key={t.slug} tool={t} />)}
            </div>
          </section>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">No tools match your search.</div>
        )}
      </main>

      <Footer />
    </div>
  );
}
