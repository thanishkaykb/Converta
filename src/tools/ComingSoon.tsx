import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function ComingSoon() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
      <div className="inline-grid h-14 w-14 place-items-center rounded-full bg-cta mb-4 shadow-[var(--shadow-glow-violet)]">
        <Sparkles className="h-7 w-7 text-white" />
      </div>
      <h2 className="font-display text-2xl font-bold">Coming soon</h2>
      <p className="text-muted-foreground mt-2 max-w-md mx-auto">
        This tool is on the roadmap. The 6 core tools (Merge, Split, Compress PDF, JPG to PDF, Resize & Compress Image)
        are fully working today — try one of those!
      </p>
      <Button asChild className="mt-6 bg-cta border-0 text-white hover:opacity-90">
        <Link to="/">Back to all tools</Link>
      </Button>
    </div>
  );
}
