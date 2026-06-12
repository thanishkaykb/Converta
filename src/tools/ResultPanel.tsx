import { Button } from "@/components/ui/button";
import { Download, RotateCcw } from "lucide-react";
import { formatBytes, downloadBlob } from "@/lib/format";
import { useEffect, useState, type ReactNode } from "react";

interface Props {
  filename: string;
  blob: Blob;
  originalSize?: number;
  onReset: () => void;
  children?: ReactNode;
}

export function ResultPanel({ filename, blob, originalSize, onReset, children }: Props) {
  const saving = originalSize ? Math.max(0, 1 - blob.size / originalSize) : 0;
  const [url, setUrl] = useState("");

  useEffect(() => {
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  const isPdf = blob.type === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
  const isImage = blob.type.startsWith("image/");

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
      {url && (isPdf || isImage) && (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-background text-left">
          <div className="border-b border-border px-4 py-2 text-sm font-medium">Output preview</div>
          {isPdf ? (
            <iframe title="Processed PDF preview" src={url} className="h-[70vh] w-full bg-white" />
          ) : (
            <div className="grid max-h-[70vh] place-items-center overflow-auto bg-white p-4">
              <img src={url} alt="Processed file preview" className="max-h-full max-w-full" />
            </div>
          )}
        </div>
      )}
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
