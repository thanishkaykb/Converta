import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Eye, Loader2 } from "lucide-react";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PdfPagePreview {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export async function renderPdfPageImages(
  file: File,
  scale = 0.55,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfPagePreview[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: PdfPagePreview[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    pages.push({ pageNumber: i, dataUrl: canvas.toDataURL("image/jpeg", 0.86), width: canvas.width, height: canvas.height });
    onProgress?.(i, doc.numPages);
  }

  return pages;
}

export function PdfPagesPreview({
  file,
  title = "PDF preview",
  order,
  onOrderChange,
  selectedPages,
  onTogglePage,
  selectionLabel = "Selected",
  overlay,
}: {
  file: File;
  title?: string;
  order?: number[];
  onOrderChange?: (order: number[]) => void;
  selectedPages?: Set<number>;
  onTogglePage?: (pageNumber: number) => void;
  selectionLabel?: string;
  overlay?: (page: PdfPagePreview) => ReactNode;
}) {
  const [pages, setPages] = useState<PdfPagePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPages([]);
    renderPdfPageImages(file)
      .then((next) => {
        if (cancelled) return;
        setPages(next);
        if (onOrderChange && (!order || order.length !== next.length)) onOrderChange(next.map((p) => p.pageNumber));
      })
      .catch(() => !cancelled && setError("This PDF preview could not be rendered, but you can still try processing it."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [file]);

  const ordered = order?.length ? order.map((n) => pages.find((p) => p.pageNumber === n)).filter(Boolean) as PdfPagePreview[] : pages;
  const move = (index: number, dir: -1 | 1) => {
    if (!order || !onOrderChange) return;
    const next = [...order];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onOrderChange(next);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h2 className="truncate text-sm font-semibold">{title}</h2>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{pages.length ? `${pages.length} pages` : ""}</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Rendering preview…
        </div>
      )}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {ordered.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ordered.map((page, index) => {
            const isSelected = selectedPages?.has(page.pageNumber) ?? false;
            return (
              <div key={page.pageNumber} className={cn("overflow-hidden rounded-lg border bg-background", isSelected ? "border-primary ring-2 ring-primary/30" : "border-border")}>
                <button
                  type="button"
                  onClick={() => onTogglePage?.(page.pageNumber)}
                  className="relative block w-full bg-white"
                  disabled={!onTogglePage}
                >
                  <img src={page.dataUrl} alt={`Page ${page.pageNumber} preview`} className="h-auto w-full" />
                  {overlay?.(page)}
                  {onTogglePage && (
                    <span className={cn("absolute left-2 top-2 rounded px-2 py-1 text-xs font-semibold", isSelected ? "bg-primary text-primary-foreground" : "bg-background/90 text-foreground")}>{selectionLabel}</span>
                  )}
                </button>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border p-2">
                  <span className="min-w-0 truncate text-xs font-medium">Page {page.pageNumber}</span>
                  {order && onOrderChange && (
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(index, 1)} disabled={index === ordered.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}