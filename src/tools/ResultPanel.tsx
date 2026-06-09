import { Button } from "@/components/ui/button";
import { Download, RotateCcw } from "lucide-react";
import { formatBytes, downloadBlob } from "@/lib/format";
import type { ReactNode } from "react";

interface Props {
  filename: string;
  blob: Blob;
  originalSize?: number;
  onReset: () => void;
  children?: ReactNode;
}

export function ResultPanel({ filename, blob, originalSize, onReset, children }: Props) {
  const saving = originalSize ? Math.max(0, 1 - blob.size / originalSize) : 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <div className="font-display text-2xl font-bold">Done! 🎉</div>
      <p className="text-muted-foreground mt-1">{filename}</p>
      <div className="mt-4 flex items-center justify-center gap-3 text-sm">
        {originalSize !== undefined && (
          <>
            <span className="text-muted-foreground">{formatBytes(originalSize)}</span>
            <span className="text-muted-foreground">→</span>
          </>
        )}
        <span className="font-semibold">{formatBytes(blob.size)}</span>
        {saving > 0 && (
          <span className="rounded-full bg-[color:var(--image)]/15 text-[color:var(--image)] px-2 py-0.5 text-xs font-medium">
            −{(saving * 100).toFixed(0)}%
          </span>
        )}
      </div>
      {children}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => downloadBlob(blob, filename)} size="lg" className="bg-cta border-0 text-white hover:opacity-90">
          <Download className="h-4 w-4 mr-2" /> Download
        </Button>
        <Button onClick={onReset} variant="outline" size="lg">
          <RotateCcw className="h-4 w-4 mr-2" /> Process another file
        </Button>
      </div>
    </div>
  );
}
