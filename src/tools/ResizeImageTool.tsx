import { useState } from "react";
import JSZip from "jszip";
import { FileDropzone } from "@/components/site/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ResultPanel } from "./ResultPanel";
import { logHistory } from "@/lib/history";
import { cn } from "@/lib/utils";

const PRESETS: { label: string; w: number; h: number }[] = [
  { label: "Passport Photo", w: 413, h: 531 },
  { label: "Stamp Size", w: 150, h: 150 },
  { label: "Instagram Square", w: 1080, h: 1080 },
  { label: "Instagram Story", w: 1080, h: 1920 },
  { label: "Instagram Portrait", w: 1080, h: 1350 },
  { label: "YouTube Thumbnail", w: 1280, h: 720 },
  { label: "YouTube Banner", w: 2560, h: 1440 },
  { label: "Twitter Header", w: 1500, h: 500 },
  { label: "LinkedIn Cover", w: 1584, h: 396 },
  { label: "Facebook Cover", w: 820, h: 312 },
];

async function resizeImage(file: File, w: number, h: number): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // cover fit
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale, sh = h / scale;
  const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92)!);
}

export function ResizeImageTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(["Instagram Square"]));
  const [customW, setCustomW] = useState(800);
  const [customH, setCustomH] = useState(600);
  const [useCustom, setUseCustom] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const toggle = (label: string) => {
    const next = new Set(selected);
    next.has(label) ? next.delete(label) : next.add(label);
    setSelected(next);
  };

  const run = async () => {
    if (!files.length) return;
    const targets = useCustom
      ? [{ label: `${customW}x${customH}`, w: customW, h: customH }]
      : PRESETS.filter((p) => selected.has(p.label));
    if (!targets.length) { toast.error("Pick at least one preset or use custom size"); return; }

    setWorking(true); setProgress(5);
    try {
      // Single file + single target: return image directly. Otherwise ZIP.
      if (files.length === 1 && targets.length === 1) {
        const blob = await resizeImage(files[0], targets[0].w, targets[0].h);
        const name = files[0].name.replace(/\.[^.]+$/, "") + `-${targets[0].w}x${targets[0].h}.jpg`;
        setProgress(100); setResult({ blob, name });
        logHistory({ tool_slug: "resize-image", tool_name: "Resize Image", file_names: [files[0].name], output_name: name, output_size: blob.size });
        return;
      }

      const zip = new JSZip();
      let done = 0; const total = files.length * targets.length;
      for (const f of files) {
        const base = f.name.replace(/\.[^.]+$/, "");
        for (const t of targets) {
          const blob = await resizeImage(f, t.w, t.h);
          zip.file(`${base}-${t.w}x${t.h}.jpg`, blob);
          done++; setProgress(5 + (done / total) * 90);
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      setProgress(100); setResult({ blob, name: "resized.zip" });
      logHistory({ tool_slug: "resize-image", tool_name: "Resize Image", file_names: files.map((f) => f.name), output_name: "resized.zip", output_size: blob.size });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resize");
    } finally { setWorking(false); }
  };

  if (result) return <ResultPanel filename={result.name} blob={result.blob} onReset={() => { setResult(null); setFiles([]); }} />;

  return (
    <div className="space-y-6">
      <FileDropzone files={files} setFiles={setFiles} accept={{ "image/*": [".jpg", ".jpeg", ".png", ".webp"] }} />

      {files.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="flex gap-2">
            <Button variant={!useCustom ? "default" : "outline"} onClick={() => setUseCustom(false)} className={!useCustom ? "bg-cta border-0 text-white" : ""}>Presets</Button>
            <Button variant={useCustom ? "default" : "outline"} onClick={() => setUseCustom(true)} className={useCustom ? "bg-cta border-0 text-white" : ""}>Custom size</Button>
          </div>

          {useCustom ? (
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Width (px)</Label><Input type="number" value={customW} onChange={(e) => setCustomW(+e.target.value)} className="mt-1.5" /></div>
              <div><Label>Height (px)</Label><Input type="number" value={customH} onChange={(e) => setCustomH(+e.target.value)} className="mt-1.5" /></div>
            </div>
          ) : (
            <div>
              <Label>Pick one or more presets</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label} onClick={() => toggle(p.label)}
                    className={cn(
                      "rounded-lg border p-3 text-left text-sm transition",
                      selected.has(p.label) ? "border-primary bg-primary/10" : "border-border bg-background hover:border-foreground/30",
                    )}>
                    <div className="font-medium">{p.label}</div>
                    <div className="text-xs text-muted-foreground">{p.w}×{p.h}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {working && <Progress value={progress} />}
      <div className="flex justify-center">
        <Button size="lg" onClick={run} disabled={working || !files.length} className="bg-cta border-0 text-white hover:opacity-90 px-10">
          {working ? "Resizing…" : "Resize images"}
        </Button>
      </div>
    </div>
  );
}
