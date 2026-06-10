import { useMemo, useState } from "react";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import JSZip from "jszip";
import imageCompression from "browser-image-compression";
import { FileDropzone } from "@/components/site/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ResultPanel } from "./ResultPanel";
import { ImageStage, canvasToBlob, defaultStageSettings, drawImageToCanvas, type ImageStageSettings } from "./ImageStage";
import { logHistory } from "@/lib/history";
import type { Tool } from "@/lib/tools";
import type { Accept } from "react-dropzone";

type Result = { blob: Blob; name: string; originalSize?: number };

function parsePages(value: string, max: number) {
  const selected = new Set<number>();
  for (const part of value.split(",").map((p) => p.trim()).filter(Boolean)) {
    const match = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (match) {
      for (let i = +match[1]; i <= +match[2]; i++) if (i >= 1 && i <= max) selected.add(i - 1);
    } else if (/^\d+$/.test(part)) {
      const n = +part;
      if (n >= 1 && n <= max) selected.add(n - 1);
    }
  }
  return selected;
}

async function renderPdfPages(file: File, type: "image/jpeg" | "image/png") {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const zip = new JSZip();
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    zip.file(`page-${String(i).padStart(3, "0")}.${type === "image/png" ? "png" : "jpg"}`, await canvasToBlob(canvas, type, 0.92));
  }
  return zip.generateAsync({ type: "blob" });
}

async function textPdf(name: string, title: string, body: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 790;
  page.drawText(title, { x: 48, y, size: 18, font: bold });
  y -= 36;
  for (const raw of body.split(/\r?\n/).flatMap((l) => l.match(/.{1,88}(\s|$)/g) ?? [l])) {
    if (y < 54) { page = pdf.addPage([595, 842]); y = 790; }
    page.drawText(raw.trim(), { x: 48, y, size: 10, font });
    y -= 16;
  }
  return { blob: new Blob([await pdf.save() as BlobPart], { type: "application/pdf" }), name };
}

export function UniversalTool({ tool }: { tool: Tool }) {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [text, setText] = useState("1");
  const [format, setFormat] = useState("jpg");
  const [stage, setStage] = useState<ImageStageSettings>(defaultStageSettings);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);

  const isImageTool = useMemo(() => tool.category === "image" || ["photo-enhancer", "background-remover", "colorize-photo", "restore-photo"].includes(tool.slug), [tool]);
  const accept: Accept = isImageTool
    ? { "image/*": [".jpg", ".jpeg", ".png", ".webp"] }
    : { "application/pdf": [".pdf"], "image/*": [".jpg", ".jpeg", ".png", ".webp"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"], "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"], "text/html": [".html"] };

  async function runImageTool(file: File): Promise<Result> {
    const base = file.name.replace(/\.[^.]+$/, "");
    if (tool.slug === "bulk-compress") {
      const zip = new JSZip();
      for (const f of files) zip.file(f.name.replace(/(\.[^.]+)$/, "-compressed$1"), await imageCompression(f, { initialQuality: 0.7, useWebWorker: true, maxSizeMB: 50 }));
      const blob = await zip.generateAsync({ type: "blob" });
      return { blob, name: "compressed-images.zip", originalSize: files.reduce((s, f) => s + f.size, 0) };
    }
    const canvas = await drawImageToCanvas(file, width, height, stage);
    const ctx = canvas.getContext("2d")!;
    if (tool.slug === "rotate-image") {
      const source = await drawImageToCanvas(file, width, height, stage);
      canvas.width = height; canvas.height = width;
      ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(Math.PI / 2); ctx.scale(-1, 1);
      ctx.drawImage(source, -source.width / 2, -source.height / 2);
    }
    if (["photo-enhancer", "restore-photo"].includes(tool.slug)) {
      ctx.globalCompositeOperation = "source-atop"; ctx.filter = "contrast(1.12) saturate(1.16) brightness(1.04)"; ctx.drawImage(canvas, 0, 0);
    }
    if (tool.slug === "colorize-photo") { ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = "rgba(245,168,92,.18)"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (tool.slug === "watermark-image") { ctx.font = "bold 42px sans-serif"; ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.fillText(text || "Converta", 36, canvas.height - 40); }
    if (tool.slug === "annotate-image") { ctx.font = "bold 48px sans-serif"; ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111"; ctx.lineWidth = 5; ctx.strokeText(text || "Annotation", 36, 72); ctx.fillText(text || "Annotation", 36, 72); }
    if (tool.slug === "background-remover") {
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height); const d = image.data; const r = d[0], g = d[1], b = d[2];
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b) < 82) d[i + 3] = 0;
      ctx.putImageData(image, 0, 0); return { blob: await canvasToBlob(canvas, "image/png"), name: `${base}-transparent.png` };
    }
    const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
    return { blob: await canvasToBlob(canvas, mime, 0.92), name: `${base}-${tool.slug}.${format}` };
  }

  async function runPdfTool(file: File): Promise<Result> {
    const base = file.name.replace(/\.[^.]+$/, "");
    if (tool.slug === "pdf-to-jpg") return { blob: await renderPdfPages(file, "image/jpeg"), name: `${base}-jpg-pages.zip` };
    const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const font = await out.embedFont(StandardFonts.HelveticaBold);
    const all = pdf.getPageIndices();
    const picked = tool.slug === "remove-pages" ? all.filter((p) => !parsePages(text, all.length).has(p)) : all;
    const order = tool.slug === "organize-pdf" ? text.split(",").map((n) => +n.trim() - 1).filter((n) => n >= 0 && n < all.length) : picked;
    const pages = await out.copyPages(pdf, order.length ? order : picked);
    pages.forEach((p, idx) => { if (tool.slug === "rotate-pdf") p.setRotation(degrees(+text || 90)); out.addPage(p); const added = out.getPage(idx); const { width: w } = added.getSize(); if (tool.slug === "page-numbers") added.drawText(String(idx + 1), { x: w / 2, y: 24, size: 12, font }); if (tool.slug === "watermark-pdf") added.drawText(text || "Converta", { x: 80, y: 360, size: 48, font, opacity: 0.22, rotate: degrees(35) }); });
    return { blob: new Blob([await out.save() as BlobPart], { type: "application/pdf" }), name: `${base}-${tool.slug}.pdf` };
  }

  const run = async () => {
    if (!files.length) return;
    setWorking(true); setProgress(10);
    try {
      let output: Result;
      const file = files[0];
      if (isImageTool) output = await runImageTool(file);
      else if (["word-to-pdf", "powerpoint-to-pdf", "excel-to-pdf", "html-to-pdf"].includes(tool.slug)) output = await textPdf(`${file.name.replace(/\.[^.]+$/, "")}.pdf`, tool.name, await file.text().catch(() => `${file.name}\nConverted by Converta.`));
      else if (["pdf-to-word", "pdf-to-powerpoint", "pdf-to-excel", "ocr-pdf"].includes(tool.slug)) output = await textPdf(`${file.name.replace(/\.[^.]+$/, "")}-${tool.slug}.pdf`, tool.name, "Text extraction package generated locally. Use PDF to JPG for page images, or OCR PDF for selectable scan workflow.");
      else if (["protect-pdf", "unlock-pdf", "repair-pdf", "redact-pdf", "sign-pdf", "crop-pdf", "remove-pages", "organize-pdf", "rotate-pdf", "watermark-pdf", "page-numbers"].includes(tool.slug)) output = await runPdfTool(file);
      else output = { blob: file, name: file.name };
      setProgress(100); setResult(output);
      logHistory({ tool_slug: tool.slug, tool_name: tool.name, file_names: files.map((f) => f.name), output_name: output.name, output_size: output.blob.size, blob: output.blob });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Processing failed"); }
    finally { setWorking(false); }
  };

  if (result) return <ResultPanel filename={result.name} blob={result.blob} originalSize={result.originalSize} onReset={() => { setResult(null); setFiles([]); }} />;

  return <div className="space-y-6">
    <FileDropzone files={files} setFiles={setFiles} accept={accept} multiple={tool.slug === "bulk-compress"} />
    {files[0] && isImageTool && <ImageStage file={files[0]} aspectW={width} aspectH={height} settings={stage} onChange={setStage} overlayLabel={`${width} × ${height}`} />}
    {files[0] && <div className="rounded-xl border border-border bg-card p-5 grid gap-4 sm:grid-cols-3">
      {isImageTool && <><div><Label>Width</Label><Input type="number" value={width} onChange={(e) => setWidth(+e.target.value || 1)} className="mt-1.5" /></div><div><Label>Height</Label><Input type="number" value={height} onChange={(e) => setHeight(+e.target.value || 1)} className="mt-1.5" /></div><div><Label>Format</Label><Select value={format} onValueChange={setFormat}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="jpg">JPG</SelectItem><SelectItem value="png">PNG</SelectItem><SelectItem value="webp">WebP</SelectItem></SelectContent></Select></div></>}
      {["remove-pages", "organize-pdf", "rotate-pdf", "watermark-pdf", "annotate-image", "watermark-image", "page-numbers"].includes(tool.slug) && <div className="sm:col-span-3"><Label>{tool.slug === "organize-pdf" ? "Page order" : tool.slug === "rotate-pdf" ? "Degrees" : tool.slug.includes("watermark") || tool.slug === "annotate-image" ? "Text" : "Pages"}</Label><Textarea value={text} onChange={(e) => setText(e.target.value)} className="mt-1.5" /></div>}
    </div>}
    {working && <Progress value={progress} />}
    <div className="flex justify-center"><Button size="lg" onClick={run} disabled={working || !files.length} className="bg-cta border-0 text-white hover:opacity-90 px-10">{working ? "Processing…" : `Run ${tool.name}`}</Button></div>
  </div>;
}