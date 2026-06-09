import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { FileDropzone } from "@/components/site/FileDropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ResultPanel } from "./ResultPanel";
import { logHistory } from "@/lib/history";
import { ArrowUp, ArrowDown } from "lucide-react";

export function MergePdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Blob | null>(null);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    [next[i], next[j]] = [next[j], next[i]];
    setFiles(next);
  };

  const run = async () => {
    if (files.length < 2) { toast.error("Add at least 2 PDFs to merge"); return; }
    setWorking(true); setProgress(5);
    try {
      const out = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        const bytes = await files[i].arrayBuffer();
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
        setProgress(10 + ((i + 1) / files.length) * 85);
      }
      const bytes = await out.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      setProgress(100);
      setResult(blob);
      logHistory({
        tool_slug: "merge-pdf", tool_name: "Merge PDF",
        file_names: files.map((f) => f.name),
        output_name: "merged.pdf", output_size: blob.size,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to merge");
    } finally { setWorking(false); }
  };

  if (result) return <ResultPanel filename="merged.pdf" blob={result} onReset={() => { setResult(null); setFiles([]); setProgress(0); }} />;

  return (
    <div className="space-y-6">
      <FileDropzone files={files} setFiles={setFiles} accept={{ "application/pdf": [".pdf"] }} hint="Add 2 or more PDFs · drag to reorder" />
      {files.length > 1 && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Reorder pages:</div>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
              <span className="grid h-7 w-7 place-items-center rounded bg-muted text-xs font-semibold">{i + 1}</span>
              <span className="flex-1 truncate text-sm">{f.name}</span>
              <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === files.length - 1}><ArrowDown className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
      {working && <Progress value={progress} />}
      <div className="flex justify-center">
        <Button size="lg" onClick={run} disabled={working || files.length < 2} className="bg-cta border-0 text-white hover:opacity-90 px-10">
          {working ? "Merging…" : "Merge PDFs"}
        </Button>
      </div>
    </div>
  );
}
