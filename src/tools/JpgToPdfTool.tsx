import { useState } from "react";
import { PDFDocument, PageSizes } from "pdf-lib";
import { FileDropzone } from "@/components/site/FileDropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { ResultPanel } from "./ResultPanel";
import { logHistory } from "@/lib/history";

export function JpgToPdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [orientation, setOrientation] = useState("portrait");
  const [pageSize, setPageSize] = useState("A4");
  const [margin, setMargin] = useState(20);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Blob | null>(null);

  const run = async () => {
    if (!files.length) return;
    setWorking(true); setProgress(5);
    try {
      const doc = await PDFDocument.create();
      const sizes: Record<string, [number, number]> = { A4: PageSizes.A4 as [number, number], Letter: PageSizes.Letter as [number, number] };
      let [w, h] = sizes[pageSize];
      if (orientation === "landscape") [w, h] = [h, w];
      const m = margin;

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const bytes = new Uint8Array(await f.arrayBuffer());
        const img = f.type.includes("png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const page = doc.addPage([w, h]);
        const aw = w - m * 2, ah = h - m * 2;
        const scale = Math.min(aw / img.width, ah / img.height);
        const iw = img.width * scale, ih = img.height * scale;
        page.drawImage(img, { x: (w - iw) / 2, y: (h - ih) / 2, width: iw, height: ih });
        setProgress(5 + ((i + 1) / files.length) * 90);
      }

      const out = await doc.save();
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      setProgress(100); setResult(blob);
      logHistory({ tool_slug: "jpg-to-pdf", tool_name: "JPG to PDF", file_names: files.map((f) => f.name), output_name: "images.pdf", output_size: blob.size });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to convert");
    } finally { setWorking(false); }
  };

  if (result) return <ResultPanel filename="images.pdf" blob={result} onReset={() => { setResult(null); setFiles([]); }} />;

  return (
    <div className="space-y-6">
      <FileDropzone files={files} setFiles={setFiles} accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] }} hint="Add as many JPG or PNG images as you like" />
      {files.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 grid sm:grid-cols-3 gap-4">
          <div>
            <Label>Page size</Label>
            <Select value={pageSize} onValueChange={setPageSize}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="Letter">US Letter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Orientation</Label>
            <Select value={orientation} onValueChange={setOrientation}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Margin: {margin}pt</Label>
            <Slider value={[margin]} min={0} max={80} step={4} onValueChange={([v]) => setMargin(v)} className="mt-3" />
          </div>
        </div>
      )}
      {working && <Progress value={progress} />}
      <div className="flex justify-center">
        <Button size="lg" onClick={run} disabled={working || !files.length} className="bg-cta border-0 text-white hover:opacity-90 px-10">
          {working ? "Converting…" : "Convert to PDF"}
        </Button>
      </div>
    </div>
  );
}
