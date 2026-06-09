import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import imageCompression from "browser-image-compression";
import { FileDropzone } from "@/components/site/FileDropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ResultPanel } from "./ResultPanel";
import { logHistory } from "@/lib/history";

// Strategy: rasterize each page by re-encoding embedded images via re-saving with
// pdf-lib + image re-compression of images we can extract. Since pdf-lib can't
// recompress embedded streams arbitrarily, we use a more reliable approach:
// rasterize each PDF page to a JPEG via pdfjs, then rebuild a new PDF.
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const QUALITY: Record<string, { scale: number; jpeg: number; label: string }> = {
  low: { scale: 1.0, jpeg: 0.55, label: "Smaller file · lower quality" },
  medium: { scale: 1.3, jpeg: 0.72, label: "Recommended" },
  high: { scale: 1.7, jpeg: 0.85, label: "Larger file · highest quality" },
};

export function CompressPdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState<"low" | "medium" | "high">("medium");
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; name: string; originalSize: number } | null>(null);

  const run = async () => {
    const file = files[0]; if (!file) return;
    setWorking(true); setProgress(5);
    try {
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
      const out = await PDFDocument.create();
      const { scale, jpeg } = QUALITY[level];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", jpeg)!);
        const compressed = await imageCompression(new File([blob], "p.jpg", { type: "image/jpeg" }), { initialQuality: jpeg, useWebWorker: true, maxSizeMB: 5 });
        const img = await out.embedJpg(await compressed.arrayBuffer());
        const p = out.addPage([viewport.width, viewport.height]);
        p.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });
        setProgress(5 + (i / doc.numPages) * 90);
      }
      const bytes = await out.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      setProgress(100);
      setResult({ blob, name: file.name.replace(/\.pdf$/i, "") + "-compressed.pdf", originalSize: file.size });
      logHistory({ tool_slug: "compress-pdf", tool_name: "Compress PDF", file_names: [file.name], output_name: "compressed.pdf", output_size: blob.size });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to compress");
    } finally { setWorking(false); }
  };

  if (result) return <ResultPanel filename={result.name} blob={result.blob} originalSize={result.originalSize} onReset={() => { setResult(null); setFiles([]); }} />;

  const levels: ("low" | "medium" | "high")[] = ["low", "medium", "high"];
  return (
    <div className="space-y-6">
      <FileDropzone files={files} setFiles={setFiles} accept={{ "application/pdf": [".pdf"] }} multiple={false} />
      {files[0] && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <Label>Compression level</Label>
          <div className="grid grid-cols-3 gap-2">
            {levels.map((l) => (
              <button key={l} onClick={() => setLevel(l)}
                className={`rounded-lg border p-4 text-left transition ${level === l ? "border-primary bg-primary/10" : "border-border bg-background hover:border-foreground/30"}`}>
                <div className="font-semibold capitalize">{l}</div>
                <div className="text-xs text-muted-foreground mt-1">{QUALITY[l].label}</div>
              </button>
            ))}
          </div>
          <Slider value={[levels.indexOf(level)]} max={2} step={1} onValueChange={([v]) => setLevel(levels[v])} />
        </div>
      )}
      {working && <Progress value={progress} />}
      <div className="flex justify-center">
        <Button size="lg" onClick={run} disabled={working || !files[0]} className="bg-cta border-0 text-white hover:opacity-90 px-10">
          {working ? "Compressing…" : "Compress PDF"}
        </Button>
      </div>
    </div>
  );
}
