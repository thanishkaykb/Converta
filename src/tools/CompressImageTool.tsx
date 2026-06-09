import { useState } from "react";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import { FileDropzone } from "@/components/site/FileDropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ResultPanel } from "./ResultPanel";
import { logHistory } from "@/lib/history";

export function CompressImageTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(70);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; name: string; originalSize: number } | null>(null);

  const run = async () => {
    if (!files.length) return;
    setWorking(true); setProgress(5);
    try {
      const totalIn = files.reduce((s, f) => s + f.size, 0);
      const opts = { initialQuality: quality / 100, useWebWorker: true, maxSizeMB: 50 };

      if (files.length === 1) {
        const out = await imageCompression(files[0], opts);
        setProgress(100);
        const name = files[0].name.replace(/(\.[^.]+)$/, "-compressed$1");
        setResult({ blob: out, name, originalSize: files[0].size });
        logHistory({ tool_slug: "compress-image", tool_name: "Compress Image", file_names: [files[0].name], output_name: name, output_size: out.size });
        return;
      }

      const zip = new JSZip();
      for (let i = 0; i < files.length; i++) {
        const out = await imageCompression(files[i], opts);
        zip.file(files[i].name.replace(/(\.[^.]+)$/, "-compressed$1"), out);
        setProgress(5 + ((i + 1) / files.length) * 90);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      setProgress(100); setResult({ blob, name: "compressed.zip", originalSize: totalIn });
      logHistory({ tool_slug: "compress-image", tool_name: "Compress Image", file_names: files.map((f) => f.name), output_name: "compressed.zip", output_size: blob.size });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to compress");
    } finally { setWorking(false); }
  };

  if (result) return <ResultPanel filename={result.name} blob={result.blob} originalSize={result.originalSize} onReset={() => { setResult(null); setFiles([]); }} />;

  return (
    <div className="space-y-6">
      <FileDropzone files={files} setFiles={setFiles} accept={{ "image/*": [".jpg", ".jpeg", ".png", ".webp"] }} />
      {files.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <Label>Quality</Label>
            <span className="text-sm font-semibold">{quality}%</span>
          </div>
          <Slider value={[quality]} min={20} max={95} step={5} onValueChange={([v]) => setQuality(v)} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Smaller file</span><span>Best quality</span>
          </div>
        </div>
      )}
      {working && <Progress value={progress} />}
      <div className="flex justify-center">
        <Button size="lg" onClick={run} disabled={working || !files.length} className="bg-cta border-0 text-white hover:opacity-90 px-10">
          {working ? "Compressing…" : `Compress ${files.length > 1 ? `${files.length} images` : "image"}`}
        </Button>
      </div>
    </div>
  );
}
