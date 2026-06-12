import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { formatBytes } from "@/lib/format";
import { History as HistoryIcon, FileText } from "lucide-react";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "My history — Converta" }] }),
  component: HistoryPage,
});

interface Entry {
  id: string;
  tool_slug: string;
  tool_name: string;
  file_names: string[];
  output_name: string | null;
  output_size: number | null;
  created_at: string;
}

function HistoryPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) { navigate({ to: "/auth" }); return; }
      const { data } = await supabase
        .from("tool_history" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setEntries((data as unknown as Entry[]) ?? []);
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-cta shadow-[var(--shadow-glow-violet)]">
            <HistoryIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">My history</h1>
            <p className="text-muted-foreground text-sm">Your last 100 processed files.</p>
          </div>
        </div>

        {entries === null ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <div className="font-display text-lg font-semibold">No history yet</div>
            <p className="text-sm text-muted-foreground mt-1">Use any tool and your activity will show up here.</p>
            <Link to="/" className="inline-block mt-5 text-sm text-primary hover:underline">Browse tools →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <Link
                key={e.id}
                to="/tools/$slug" params={{ slug: e.tool_slug }}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary transition"
              >
                <div className="grid h-10 w-10 place-items-center rounded-md bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{e.tool_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {e.file_names.join(", ")}
                    {e.output_size ? ` · ${formatBytes(e.output_size)}` : ""}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
