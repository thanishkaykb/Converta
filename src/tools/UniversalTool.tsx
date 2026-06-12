import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import JSZip from "jszip";
import imageCompression from "browser-image-compression";
import { FileDropzone } from "@/components/site/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ResultPanel } from "./ResultPanel";
import { ImageStage, canvasToBlob, defaultStageSettings, drawImageToCanvas, type ImageStageSettings } from "./ImageStage";
import { PdfPagesPreview, type PdfPagePreview } from "./PdfPagesPreview";
import { logHistory } from "@/lib/history";
import type { Tool } from "@/lib/tools";
import type { Accept } from "react-dropzone";

type Result = { blob: Blob; name: string; originalSize?: number };

/* ---------------- helpers ---------------- */

function parsePages(value: string, max: number): number[] {
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
  return [...selected].sort((a, b) => a - b);
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image."));
    img.src = URL.createObjectURL(file);
  });
}

async function renderPdfToCanvases(file: File, scale: number, onProgress?: (done: number, total: number) => void) {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const canvases: HTMLCanvasElement[] = [];
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
    canvases.push(canvas);
    onProgress?.(i, doc.numPages);
  }
  return canvases;
}

async function extractPdfText(file: File, onProgress?: (done: number, total: number) => void): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    let lastY: number | null = null;
    for (const item of content.items as { str: string; transform: number[] }[]) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 4) text += "\n";
      text += item.str + " ";
      lastY = item.transform[5];
    }
    pages.push(text.trim());
    onProgress?.(i, doc.numPages);
  }
  return pages;
}

async function textPdf(name: string, title: string, body: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 790;
  if (title) { page.drawText(title.slice(0, 80), { x: 48, y, size: 16, font: bold }); y -= 32; }
  const clean = body.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "");
  for (const raw of clean.split(/\r?\n/).flatMap((l) => (l.length ? l.match(/.{1,92}(\s|$)/g) ?? [l] : [""]))) {
    if (y < 54) { page = pdf.addPage([595, 842]); y = 790; }
    if (raw.trim()) page.drawText(raw.trim(), { x: 48, y, size: 10, font });
    y -= 15;
  }
  return { blob: new Blob([await pdf.save() as BlobPart], { type: "application/pdf" }), name };
}

const POSITIONS = [
  { value: "center", label: "Center (diagonal)" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-center", label: "Bottom center" },
];

/* ---------------- component ---------------- */

export function UniversalTool({ tool }: { tool: Tool }) {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // shared option states
  const [pagesText, setPagesText] = useState("");
  const [wmText, setWmText] = useState("");
  const [wmOpacity, setWmOpacity] = useState(0.3);
  const [wmSize, setWmSize] = useState(48);
  const [position, setPosition] = useState("center");
  const [angle, setAngle] = useState("90");
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [startNumber, setStartNumber] = useState(1);
  const [margin, setMargin] = useState({ top: 10, right: 10, bottom: 10, left: 10 });
  const [rect, setRect] = useState({ x: 10, y: 10, w: 40, h: 10 });
  const [signName, setSignName] = useState("");
  const [format, setFormat] = useState("jpg");
  const [quality, setQuality] = useState(0.9);
  const [tolerance, setTolerance] = useState(60);
  const [stage, setStage] = useState<ImageStageSettings>(defaultStageSettings);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);

  const slug = tool.slug;
  const isImageTool = useMemo(
    () => tool.category === "image" || ["photo-enhancer", "background-remover", "colorize-photo", "restore-photo"].includes(slug),
    [tool, slug],
  );
  const multiple = ["bulk-compress", "ocr-pdf"].includes(slug);

  const accept: Accept = useMemo(() => {
    if (isImageTool) return { "image/*": [".jpg", ".jpeg", ".png", ".webp"] } as Accept;
    if (slug === "word-to-pdf") return { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] } as Accept;
    if (slug === "excel-to-pdf") return { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx", ".xls"] } as Accept;
    if (slug === "powerpoint-to-pdf") return { "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"] } as Accept;
    if (slug === "html-to-pdf") return { "text/html": [".html", ".htm"] } as Accept;
    if (slug === "ocr-pdf") return { "application/pdf": [".pdf"], "image/*": [".jpg", ".jpeg", ".png", ".webp"] } as Accept;
    return { "application/pdf": [".pdf"] } as Accept;
  }, [slug, isImageTool]);

  /* -------- PDF tools -------- */

  async function runPdf(file: File): Promise<Result> {
    const base = file.name.replace(/\.[^.]+$/, "");
    const bytes = await file.arrayBuffer();

    if (slug === "protect-pdf") {
      if (!password) throw new Error("Enter a password to protect the PDF.");
      if (password !== password2) throw new Error("Passwords do not match.");
      const { PDFDocument: CantooPDF } = await import("@cantoo/pdf-lib");
      const doc = await CantooPDF.load(bytes, { ignoreEncryption: true });
      doc.encrypt({ userPassword: password, ownerPassword: password });
      const out = await doc.save({ useObjectStreams: false });
      return { blob: new Blob([out as BlobPart], { type: "application/pdf" }), name: `${base}-protected.pdf` };
    }

    if (slug === "unlock-pdf") {
      if (!password) throw new Error("Enter the PDF's current password.");
      const { PDFDocument: CantooPDF } = await import("@cantoo/pdf-lib");
      const doc = await CantooPDF.load(bytes, { password, ignoreEncryption: true } as never);
      const fresh = await CantooPDF.create();
      (await fresh.copyPages(doc, doc.getPageIndices())).forEach((p) => fresh.addPage(p));
      const out = await fresh.save();
      return { blob: new Blob([out as BlobPart], { type: "application/pdf" }), name: `${base}-unlocked.pdf` };
    }

    if (slug === "repair-pdf") {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false });
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
      return { blob: new Blob([await out.save() as BlobPart], { type: "application/pdf" }), name: `${base}-repaired.pdf` };
    }

    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = pdf.getPageCount();

    if (slug === "remove-pages") {
      const toRemove = parsePages(pagesText, total);
      if (!toRemove.length) throw new Error("Enter the pages to remove, e.g. 2, 4-6.");
      if (toRemove.length >= total) throw new Error("You can't remove every page.");
      const out = await PDFDocument.create();
      const keep = pdf.getPageIndices().filter((i) => !toRemove.includes(i));
      (await out.copyPages(pdf, keep)).forEach((p) => out.addPage(p));
      return { blob: new Blob([await out.save() as BlobPart], { type: "application/pdf" }), name: `${base}-removed.pdf` };
    }

    if (slug === "organize-pdf") {
      const order = pagesText.split(",").map((n) => +n.trim() - 1).filter((n) => Number.isInteger(n) && n >= 0 && n < total);
      if (!order.length) throw new Error(`Enter the new page order, e.g. 3,1,2 (this PDF has ${total} pages).`);
      const out = await PDFDocument.create();
      (await out.copyPages(pdf, order)).forEach((p) => out.addPage(p));
      return { blob: new Blob([await out.save() as BlobPart], { type: "application/pdf" }), name: `${base}-organized.pdf` };
    }

    if (slug === "rotate-pdf") {
      const deg = +angle;
      const targets = pagesText.trim() ? parsePages(pagesText, total) : pdf.getPageIndices();
      targets.forEach((i) => { const p = pdf.getPage(i); p.setRotation(degrees(((p.getRotation().angle + deg) % 360 + 360) % 360)); });
      return { blob: new Blob([await pdf.save() as BlobPart], { type: "application/pdf" }), name: `${base}-rotated.pdf` };
    }

    if (slug === "watermark-pdf") {
      if (!wmText.trim()) throw new Error("Enter the watermark text first.");
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);
      pdf.getPages().forEach((p) => {
        const { width: w, height: h } = p.getSize();
        const tw = font.widthOfTextAtSize(wmText, wmSize);
        let x = (w - tw) / 2, y = h / 2, rot = 0;
        if (position === "center") rot = 35;
        if (position === "top-left") { x = 36; y = h - 60; }
        if (position === "top-right") { x = w - tw - 36; y = h - 60; }
        if (position === "bottom-left") { x = 36; y = 40; }
        if (position === "bottom-right") { x = w - tw - 36; y = 40; }
        if (position === "bottom-center") { y = 40; }
        p.drawText(wmText, { x, y, size: wmSize, font, opacity: wmOpacity, rotate: degrees(rot), color: rgb(0.4, 0.4, 0.4) });
      });
      return { blob: new Blob([await pdf.save() as BlobPart], { type: "application/pdf" }), name: `${base}-watermarked.pdf` };
    }

    if (slug === "page-numbers") {
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      pdf.getPages().forEach((p, idx) => {
        const { width: w, height: h } = p.getSize();
        const label = String(startNumber + idx);
        const tw = font.widthOfTextAtSize(label, 11);
        const x = position.includes("left") ? 36 : position.includes("right") ? w - tw - 36 : (w - tw) / 2;
        const y = position.startsWith("top") ? h - 30 : 22;
        p.drawText(label, { x, y, size: 11, font, color: rgb(0.25, 0.25, 0.25) });
      });
      return { blob: new Blob([await pdf.save() as BlobPart], { type: "application/pdf" }), name: `${base}-numbered.pdf` };
    }

    if (slug === "crop-pdf") {
      pdf.getPages().forEach((p) => {
        const { width: w, height: h } = p.getSize();
        const x = (margin.left / 100) * w;
        const y = (margin.bottom / 100) * h;
        const cw = w - x - (margin.right / 100) * w;
        const ch = h - y - (margin.top / 100) * h;
        if (cw > 20 && ch > 20) { p.setCropBox(x, y, cw, ch); p.setMediaBox(x, y, cw, ch); }
      });
      return { blob: new Blob([await pdf.save() as BlobPart], { type: "application/pdf" }), name: `${base}-cropped.pdf` };
    }

    if (slug === "redact-pdf") {
      const targets = pagesText.trim() ? parsePages(pagesText, total) : pdf.getPageIndices();
      targets.forEach((i) => {
        const p = pdf.getPage(i);
        const { width: w, height: h } = p.getSize();
        p.drawRectangle({
          x: (rect.x / 100) * w,
          y: h - ((rect.y + rect.h) / 100) * h,
          width: (rect.w / 100) * w,
          height: (rect.h / 100) * h,
          color: rgb(0, 0, 0),
        });
      });
      return { blob: new Blob([await pdf.save() as BlobPart], { type: "application/pdf" }), name: `${base}-redacted.pdf` };
    }

    if (slug === "sign-pdf") {
      if (!signName.trim()) throw new Error("Type your signature name first.");
      const font = await pdf.embedFont(StandardFonts.TimesRomanItalic);
      const pageIdx = Math.min(Math.max((parseInt(pagesText) || total) - 1, 0), total - 1);
      const p = pdf.getPage(pageIdx);
      const { width: w } = p.getSize();
      const tw = font.widthOfTextAtSize(signName, 32);
      const x = position.includes("left") ? 48 : position.includes("right") ? w - tw - 48 : (w - tw) / 2;
      p.drawText(signName, { x, y: 70, size: 32, font, color: rgb(0.1, 0.15, 0.5) });
      p.drawLine({ start: { x, y: 62 }, end: { x: x + tw, y: 62 }, thickness: 1, color: rgb(0.1, 0.15, 0.5) });
      return { blob: new Blob([await pdf.save() as BlobPart], { type: "application/pdf" }), name: `${base}-signed.pdf` };
    }

    throw new Error("Unsupported PDF operation.");
  }

  /* -------- conversions -------- */

  async function runConvert(file: File): Promise<Result> {
    const base = file.name.replace(/\.[^.]+$/, "");

    if (slug === "pdf-to-jpg") {
      const canvases = await renderPdfToCanvases(file, 2, (d, t) => setProgress(Math.round((d / t) * 90)));
      const zip = new JSZip();
      for (let i = 0; i < canvases.length; i++) zip.file(`page-${String(i + 1).padStart(3, "0")}.jpg`, await canvasToBlob(canvases[i], "image/jpeg", 0.92));
      return { blob: await zip.generateAsync({ type: "blob" }), name: `${base}-pages.zip` };
    }

    if (slug === "pdf-to-word") {
      const pages = await extractPdfText(file, (d, t) => setProgress(Math.round((d / t) * 80)));
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
      const children = pages.flatMap((text, i) => [
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(`Page ${i + 1}`)] }),
        ...text.split(/\n/).map((line) => new Paragraph({ children: [new TextRun(line)] })),
      ]);
      const doc = new Document({ sections: [{ children }] });
      return { blob: await Packer.toBlob(doc), name: `${base}.docx` };
    }

    if (slug === "pdf-to-excel") {
      const pages = await extractPdfText(file, (d, t) => setProgress(Math.round((d / t) * 80)));
      const XLSX = await import("xlsx");
      const rows = pages.flatMap((text, i) => [[`— Page ${i + 1} —`], ...text.split(/\n/).map((line) => line.split(/\s{2,}/))]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Extracted");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      return { blob: new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name: `${base}.xlsx` };
    }

    if (slug === "pdf-to-powerpoint") {
      const canvases = await renderPdfToCanvases(file, 1.5, (d, t) => setProgress(Math.round((d / t) * 80)));
      const PptxGen = (await import("pptxgenjs")).default;
      const pptx = new PptxGen();
      pptx.defineLayout({ name: "PAGE", width: 10, height: 10 * (canvases[0].height / canvases[0].width) });
      pptx.layout = "PAGE";
      for (const canvas of canvases) {
        const slide = pptx.addSlide();
        slide.addImage({ data: canvas.toDataURL("image/jpeg", 0.85), x: 0, y: 0, w: "100%", h: "100%" });
      }
      return { blob: (await pptx.write({ outputType: "blob" })) as Blob, name: `${base}.pptx` };
    }

    if (slug === "ocr-pdf") {
      const Tesseract = await import("tesseract.js");
      const tWorker = await Tesseract.createWorker("eng");
      let out = "";
      try {
        for (const f of files) {
          let sources: (HTMLCanvasElement | File)[];
          if (f.type === "application/pdf") sources = await renderPdfToCanvases(f, 2, (d, t) => setProgress(Math.round((d / t) * 40)));
          else sources = [f];
          for (let i = 0; i < sources.length; i++) {
            const { data } = await tWorker.recognize(sources[i] as never);
            out += `\n--- ${f.name}${sources.length > 1 ? ` (page ${i + 1})` : ""} ---\n${data.text}\n`;
            setProgress(40 + Math.round(((i + 1) / sources.length) * 55));
          }
        }
      } finally {
        await tWorker.terminate();
      }
      if (!out.trim()) throw new Error("No text could be recognized in this file.");
      return await textPdf(`${base}-ocr.pdf`, "Recognized text (OCR)", out);
    }

    if (slug === "word-to-pdf") {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      if (!value.trim()) throw new Error("This document appears to be empty.");
      return await textPdf(`${base}.pdf`, "", value);
    }

    if (slug === "excel-to-pdf") {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      let text = "";
      for (const name of wb.SheetNames) text += `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}\n\n`;
      return await textPdf(`${base}.pdf`, "", text);
    }

    if (slug === "powerpoint-to-pdf") {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const slideFiles = Object.keys(zip.files)
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => +a.match(/\d+/)![0] - +b.match(/\d+/)![0]);
      if (!slideFiles.length) throw new Error("No slides found in this PPTX.");
      let text = "";
      for (let i = 0; i < slideFiles.length; i++) {
        const xml = await zip.files[slideFiles[i]].async("string");
        const parts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
        text += `Slide ${i + 1}\n${parts.join("\n")}\n\n`;
      }
      return await textPdf(`${base}.pdf`, "", text);
    }

    if (slug === "html-to-pdf") {
      const html = await file.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("script,style").forEach((el) => el.remove());
      const text = (doc.body?.innerText ?? doc.body?.textContent ?? "").trim();
      if (!text) throw new Error("No readable text found in this HTML file.");
      return await textPdf(`${base}.pdf`, doc.title || "", text);
    }

    throw new Error("Unsupported conversion.");
  }

  /* -------- image tools -------- */

  async function runImage(file: File): Promise<Result> {
    const base = file.name.replace(/\.[^.]+$/, "");

    if (slug === "bulk-compress") {
      const zip = new JSZip();
      for (let i = 0; i < files.length; i++) {
        zip.file(files[i].name.replace(/(\.[^.]+)$/, "-compressed$1"), await imageCompression(files[i], { initialQuality: quality, useWebWorker: true, maxSizeMB: 50 }));
        setProgress(Math.round(((i + 1) / files.length) * 90));
      }
      return { blob: await zip.generateAsync({ type: "blob" }), name: "compressed-images.zip", originalSize: files.reduce((s, f) => s + f.size, 0) };
    }

    if (slug === "crop-image" || slug === "resize-image") {
      const canvas = await drawImageToCanvas(file, width, height, stage);
      const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
      return { blob: await canvasToBlob(canvas, mime, quality), name: `${base}-cropped.${format}`, originalSize: file.size };
    }

    // all other tools work at the image's natural size
    const img = await loadImage(file);
    const W = img.naturalWidth, H = img.naturalHeight;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";

    if (slug === "rotate-image") {
      const deg = +angle % 360;
      const swap = deg === 90 || deg === 270;
      canvas.width = swap ? H : W;
      canvas.height = swap ? W : H;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, -W / 2, -H / 2);
    } else if (["photo-enhancer", "restore-photo"].includes(slug)) {
      canvas.width = W; canvas.height = H;
      ctx.filter = "contrast(1.12) saturate(1.18) brightness(1.05)";
      ctx.drawImage(img, 0, 0);
      ctx.filter = "none";
    } else if (slug === "colorize-photo") {
      canvas.width = W; canvas.height = H;
      ctx.drawImage(img, 0, 0);
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = "rgba(245,168,92,.25)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    } else if (slug === "background-remover") {
      canvas.width = W; canvas.height = H;
      ctx.drawImage(img, 0, 0);
      const image = ctx.getImageData(0, 0, W, H);
      const d = image.data;
      const r = d[0], g = d[1], b = d[2];
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b) < tolerance * 3) d[i + 3] = 0;
      }
      ctx.putImageData(image, 0, 0);
      URL.revokeObjectURL(img.src);
      return { blob: await canvasToBlob(canvas, "image/png"), name: `${base}-transparent.png`, originalSize: file.size };
    } else if (slug === "watermark-image" || slug === "annotate-image") {
      if (!wmText.trim()) throw new Error(slug === "watermark-image" ? "Enter the watermark text first." : "Enter the annotation text first.");
      canvas.width = W; canvas.height = H;
      ctx.drawImage(img, 0, 0);
      const size = Math.max(16, Math.round((wmSize / 100) * W * 0.12));
      ctx.font = `bold ${size}px sans-serif`;
      const tw = ctx.measureText(wmText).width;
      let x = (W - tw) / 2, y = H / 2;
      if (position === "top-left") { x = 24; y = size + 24; }
      if (position === "top-right") { x = W - tw - 24; y = size + 24; }
      if (position === "bottom-left") { x = 24; y = H - 32; }
      if (position === "bottom-right") { x = W - tw - 24; y = H - 32; }
      if (position === "bottom-center") { y = H - 32; }
      ctx.globalAlpha = slug === "watermark-image" ? wmOpacity : 1;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.6)";
      ctx.lineWidth = Math.max(2, size / 14);
      if (position === "center" && slug === "watermark-image") {
        ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 8);
        ctx.strokeText(wmText, -tw / 2, 0); ctx.fillText(wmText, -tw / 2, 0);
        ctx.restore();
      } else {
        ctx.strokeText(wmText, x, y); ctx.fillText(wmText, x, y);
      }
      ctx.globalAlpha = 1;
    } else {
      // convert-image and anything else: natural-size re-encode
      canvas.width = W; canvas.height = H;
      ctx.drawImage(img, 0, 0);
    }

    URL.revokeObjectURL(img.src);
    const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
    const ext = format === "png" ? "png" : format === "webp" ? "webp" : "jpg";
    return { blob: await canvasToBlob(canvas, mime, quality), name: `${base}-${slug}.${ext}`, originalSize: file.size };
  }

  /* -------- run -------- */

  const run = async () => {
    if (!files.length) { toast.error("Add a file first."); return; }
    setWorking(true);
    setProgress(5);
    try {
      let output: Result;
      const file = files[0];
      if (isImageTool) output = await runImage(file);
      else if (["pdf-to-jpg", "pdf-to-word", "pdf-to-excel", "pdf-to-powerpoint", "ocr-pdf", "word-to-pdf", "excel-to-pdf", "powerpoint-to-pdf", "html-to-pdf"].includes(slug)) output = await runConvert(file);
      else output = await runPdf(file);
      setProgress(100);
      setResult(output);
      logHistory({ tool_slug: slug, tool_name: tool.name, file_names: files.map((f) => f.name), output_name: output.name, output_size: output.blob.size, blob: output.blob });
      toast.success(`${tool.name} complete!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Processing failed. Please try a different file.");
    } finally {
      setWorking(false);
    }
  };

  if (result) {
    return <ResultPanel filename={result.name} blob={result.blob} originalSize={result.originalSize} onReset={() => { setResult(null); setFiles([]); setProgress(0); }} />;
  }

  /* -------- options UI -------- */

  const showStage = files[0] && ["crop-image", "resize-image"].includes(slug);
  const field = (label: string, node: React.ReactNode, full = false) => (
    <div className={full ? "sm:col-span-2" : ""}><Label>{label}</Label><div className="mt-1.5">{node}</div></div>
  );

  return (
    <div className="space-y-6">
      <FileDropzone files={files} setFiles={setFiles} accept={accept} multiple={multiple} />

      {showStage && (
        <ImageStage file={files[0]} aspectW={width} aspectH={height} settings={stage} onChange={setStage} overlayLabel={`${width} × ${height}`} />
      )}

      {files.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 grid gap-4 sm:grid-cols-2">
          {/* PDF page selections */}
          {slug === "remove-pages" && field("Pages to remove", <Input value={pagesText} onChange={(e) => setPagesText(e.target.value)} placeholder="e.g. 2, 4-6" />, true)}
          {slug === "organize-pdf" && field("New page order", <Input value={pagesText} onChange={(e) => setPagesText(e.target.value)} placeholder="e.g. 3, 1, 2" />, true)}
          {slug === "rotate-pdf" && (<>
            {field("Rotation", <Select value={angle} onValueChange={setAngle}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="90">90° clockwise</SelectItem><SelectItem value="180">180°</SelectItem><SelectItem value="270">90° counter-clockwise</SelectItem></SelectContent></Select>)}
            {field("Pages (empty = all)", <Input value={pagesText} onChange={(e) => setPagesText(e.target.value)} placeholder="e.g. 1, 3-5" />)}
          </>)}

          {/* Watermark */}
          {(slug === "watermark-pdf" || slug === "watermark-image" || slug === "annotate-image") && (<>
            {field(slug === "annotate-image" ? "Annotation text" : "Watermark text", <Input value={wmText} onChange={(e) => setWmText(e.target.value)} placeholder={slug === "annotate-image" ? "Type your note…" : "e.g. CONFIDENTIAL"} />, true)}
            {field("Position", <Select value={position} onValueChange={setPosition}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select>)}
            {slug !== "annotate-image" && field(`Opacity — ${Math.round(wmOpacity * 100)}%`, <Slider value={[wmOpacity]} min={0.05} max={1} step={0.05} onValueChange={([v]) => setWmOpacity(v)} className="pt-3" />)}
            {field(`Size — ${wmSize}`, <Slider value={[wmSize]} min={12} max={120} step={2} onValueChange={([v]) => setWmSize(v)} className="pt-3" />)}
          </>)}

          {/* Page numbers */}
          {slug === "page-numbers" && (<>
            {field("Position", <Select value={position.startsWith("top") || position.startsWith("bottom") ? position : "bottom-center"} onValueChange={setPosition}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bottom-center">Bottom center</SelectItem><SelectItem value="bottom-right">Bottom right</SelectItem><SelectItem value="bottom-left">Bottom left</SelectItem><SelectItem value="top-right">Top right</SelectItem><SelectItem value="top-left">Top left</SelectItem></SelectContent></Select>)}
            {field("Start at", <Input type="number" min={1} value={startNumber} onChange={(e) => setStartNumber(Math.max(1, +e.target.value || 1))} />)}
          </>)}

          {/* Crop PDF */}
          {slug === "crop-pdf" && (<>
            {field(`Top margin — ${margin.top}%`, <Slider value={[margin.top]} min={0} max={40} step={1} onValueChange={([v]) => setMargin({ ...margin, top: v })} className="pt-3" />)}
            {field(`Bottom margin — ${margin.bottom}%`, <Slider value={[margin.bottom]} min={0} max={40} step={1} onValueChange={([v]) => setMargin({ ...margin, bottom: v })} className="pt-3" />)}
            {field(`Left margin — ${margin.left}%`, <Slider value={[margin.left]} min={0} max={40} step={1} onValueChange={([v]) => setMargin({ ...margin, left: v })} className="pt-3" />)}
            {field(`Right margin — ${margin.right}%`, <Slider value={[margin.right]} min={0} max={40} step={1} onValueChange={([v]) => setMargin({ ...margin, right: v })} className="pt-3" />)}
          </>)}

          {/* Redact */}
          {slug === "redact-pdf" && (<>
            {field("Pages (empty = all)", <Input value={pagesText} onChange={(e) => setPagesText(e.target.value)} placeholder="e.g. 1, 3" />, true)}
            {field(`Box left — ${rect.x}%`, <Slider value={[rect.x]} min={0} max={90} step={1} onValueChange={([v]) => setRect({ ...rect, x: v })} className="pt-3" />)}
            {field(`Box top — ${rect.y}%`, <Slider value={[rect.y]} min={0} max={90} step={1} onValueChange={([v]) => setRect({ ...rect, y: v })} className="pt-3" />)}
            {field(`Box width — ${rect.w}%`, <Slider value={[rect.w]} min={5} max={100} step={1} onValueChange={([v]) => setRect({ ...rect, w: v })} className="pt-3" />)}
            {field(`Box height — ${rect.h}%`, <Slider value={[rect.h]} min={2} max={100} step={1} onValueChange={([v]) => setRect({ ...rect, h: v })} className="pt-3" />)}
          </>)}

          {/* Sign */}
          {slug === "sign-pdf" && (<>
            {field("Your signature (typed)", <Input value={signName} onChange={(e) => setSignName(e.target.value)} placeholder="e.g. John Appleseed" />, true)}
            {field("Position", <Select value={position} onValueChange={setPosition}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bottom-left">Bottom left</SelectItem><SelectItem value="bottom-center">Bottom center</SelectItem><SelectItem value="bottom-right">Bottom right</SelectItem></SelectContent></Select>)}
            {field("Page number (empty = last)", <Input value={pagesText} onChange={(e) => setPagesText(e.target.value)} placeholder="e.g. 1" />)}
          </>)}

          {/* Protect / Unlock */}
          {slug === "protect-pdf" && (<>
            {field("Password", <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a password" />)}
            {field("Confirm password", <Input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Repeat password" />)}
          </>)}
          {slug === "unlock-pdf" && field("Current password", <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password of the PDF" />, true)}

          {/* Rotate / flip image */}
          {slug === "rotate-image" && (<>
            {field("Rotation", <Select value={angle} onValueChange={setAngle}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">No rotation</SelectItem><SelectItem value="90">90° clockwise</SelectItem><SelectItem value="180">180°</SelectItem><SelectItem value="270">90° counter-clockwise</SelectItem></SelectContent></Select>)}
            <div className="flex items-end gap-6 pb-1">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={flipH} onCheckedChange={(v) => setFlipH(v === true)} /> Flip horizontal</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={flipV} onCheckedChange={(v) => setFlipV(v === true)} /> Flip vertical</label>
            </div>
          </>)}

          {/* Crop image dims */}
          {showStage && (<>
            {field("Width (px)", <Input type="number" min={16} value={width} onChange={(e) => setWidth(Math.max(16, +e.target.value || 16))} />)}
            {field("Height (px)", <Input type="number" min={16} value={height} onChange={(e) => setHeight(Math.max(16, +e.target.value || 16))} />)}
          </>)}

          {/* Background remover */}
          {slug === "background-remover" && field(`Sensitivity — ${tolerance}`, <Slider value={[tolerance]} min={10} max={150} step={5} onValueChange={([v]) => setTolerance(v)} className="pt-3" />, true)}

          {/* Output format / quality for image tools */}
          {isImageTool && !["background-remover", "bulk-compress"].includes(slug) && (
            field("Output format", <Select value={format} onValueChange={setFormat}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="jpg">JPG</SelectItem><SelectItem value="png">PNG</SelectItem><SelectItem value="webp">WebP</SelectItem></SelectContent></Select>)
          )}
          {isImageTool && slug !== "background-remover" && (
            field(`Quality — ${Math.round(quality * 100)}%`, <Slider value={[quality]} min={0.3} max={1} step={0.05} onValueChange={([v]) => setQuality(v)} className="pt-3" />)
          )}
        </div>
      )}

      {working && <Progress value={progress} />}

      <div className="flex justify-center">
        <Button size="lg" onClick={run} disabled={working || !files.length} className="bg-cta border-0 text-white hover:opacity-90 px-10">
          {working ? "Processing…" : `Run ${tool.name}`}
        </Button>
      </div>
    </div>
  );
}
