import { useState, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { FileDropzone } from "@/components/site/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ResultPanel } from "./ResultPanel";
import { logHistory } from "@/lib/history";

export function SplitPdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"range" | "all">("range");
  const [range, setRange] = useState("1-1");
  const [pageCount, setPageCount] = useState(0);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  useEffect(() => {
    if (!files[0]) { setPageCount(0); return; }
    files[0].arrayBuffer()
      .then((b) => PDFDocument.load(b, { ignoreEncryption: true }))
      .then((d) => { setPageCount(d.getPageCount()); setRange(`1-${d.getPageCount()}`); })
      .catch(() => setPageCount(0));
  }, [files]);

  const parseRange = (r: string, max: number): number[] => {
    const set = new Set<number>();
    for (const part of r.split(",").map((s) => s.trim()).filter(Boolean)) {
      const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        const a = +m[1], b = +m[2];
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= max) set.add(i - 1);
      } else if (/^\d+$/.test(part)) {
        const n = +part; if (n >= 1 && n <= max) set.add(n - 1);
      }
    }
    return [...set].sort((a, b) => a - b);
  };

  const run = async () => {
    const file = files[0]; if (!file) return;
    setWorking(true); setProgress(10);
    try {
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      if (mode === "range") {
        const idx = parseRange(range, src.getPageCount());
        if (!idx.length) throw new Error("No pages in that range");
        const out = await PDFDocument.create();
        const copied = await out.copyPages(src, idx);
        copied.forEach((p) => out.addPage(p));
        const bytes = await out.save();
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
        setProgress(100); setResult({ blob, name: file.name.replace(/\.pdf$/i, "") + "-split.pdf" });
        logHistory({ tool_slug: "split-pdf", tool_name: "Split PDF", file_names: [file.name], output_name: "split.pdf", output_size: blob.size });
      } else {
        const zip = new JSZip();
        const total = src.getPageCount();
        for (let i = 0; i < total; i++) {
          const out = await PDFDocument.create();
          const [p] = await out.copyPages(src, [i]);
          out.addPage(p);
          const bytes = await out.save();
          zip.file(`page-${String(i + 1).padStart(3, "0")}.pdf`, bytes as Uint8Array);
          setProgress(10 + ((i + 1) / total) * 85);
        }
        const blob = await zip.generateAsync({ type: "blob" });
        setProgress(100); setResult({ blob, name: file.name.replace(/\.pdf$/i, "") + "-pages.zip" });
        logHistory({ tool_slug: "split-pdf", tool_name: "Split PDF", file_names: [file.name], output_name: "pages.zip", output_size: blob.size });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to split");
    } finally { setWorking(false); }
  };

  if (result) return <ResultPanel filename={result.name} blob={result.blob} onReset={() => { setResult(null); setFiles([]); }} />;

  return (
    <div className="space-y-6">
      <FileDropzone files={files} setFiles={setFiles} accept={{ "application/pdf": [".pdf"] }} multiple={false} hint="Upload a single PDF" />
      {files[0] && pageCount > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="text-sm text-muted-foreground">PDF has <b className="text-foreground">{pageCount}</b> pages.</div>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "range" | "all")}>
            <div className="flex items-center gap-2"><RadioGroupItem value="range" id="r1" /><Label htmlFor="r1">Extract a page range</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="all" id="r2" /><Label htmlFor="r2">Split every page into a separate PDF (ZIP)</Label></div>
          </RadioGroup>
          {mode === "range" && (
            <div>
              <Label>Pages</Label>
              <Input value={range} onChange={(e) => setRange(e.target.value)} placeholder="e.g. 1-3, 5, 8-10" className="mt-1.5" />
            </div>
          )}
        </div>
      )}
      {working && <Progress value={progress} />}
      <div className="flex justify-center">
        <Button size="lg" onClick={run} disabled={working || !files[0]} className="bg-cta border-0 text-white hover:opacity-90 px-10">
          {working ? "Splitting…" : "Split PDF"}
        </Button>
      </div>
    </div>
  );
}
