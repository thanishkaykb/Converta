import { useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Loader2, Move, Upload } from "lucide-react";
import { FileDropzone } from "@/components/site/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { logHistory } from "@/lib/history";
import { ResultPanel } from "./ResultPanel";
import { renderPdfPageImages, type PdfPagePreview } from "./PdfPagesPreview";

export function SignPdfTool() {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [signatureFiles, setSignatureFiles] = useState<File[]>([]);
  const [typedSignature, setTypedSignature] = useState("");
  const [pages, setPages] = useState<PdfPagePreview[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pos, setPos] = useState({ x: 52, y: 72, w: 28 });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const pdf = pdfFiles[0];
  const signature = signatureFiles[0];
  const signatureUrl = useMemo(() => signature ? URL.createObjectURL(signature) : "", [signature]);

  useEffect(() => () => { if (signatureUrl) URL.revokeObjectURL(signatureUrl); }, [signatureUrl]);

  useEffect(() => {
    if (!pdf) { setPages([]); return; }
    let cancelled = false;
    setPreviewLoading(true);
    renderPdfPageImages(pdf, 0.62)
      .then((next) => {
        if (cancelled) return;
        setPages(next);
        setPageNumber(1);
      })
      .catch(() => toast.error("Could not render this PDF preview."))
      .finally(() => !cancelled && setPreviewLoading(false));
    return () => { cancelled = true; };
  }, [pdf]);

  const selectedPage = pages.find((p) => p.pageNumber === pageNumber) ?? pages[0];
  const overlayText = typedSignature.trim() || "Signature";

  const updateFromPointer = (clientX: number, clientY: number, element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    const dx = dragRef.current?.dx ?? 0;
    const dy = dragRef.current?.dy ?? 0;
    const nextX = ((clientX - box.left - dx) / box.width) * 100;
    const nextY = ((clientY - box.top - dy) / box.height) * 100;
    setPos((current) => ({ ...current, x: Math.min(100 - current.w, Math.max(0, nextX)), y: Math.min(92, Math.max(0, nextY)) }));
  };

  const run = async () => {
    if (!pdf) { toast.error("Upload a PDF first."); return; }
    if (!signature && !typedSignature.trim()) { toast.error("Upload your signature image or type a signature."); return; }
    setWorking(true); setProgress(15);
    try {
      const doc = await PDFDocument.load(await pdf.arrayBuffer(), { ignoreEncryption: true });
      const pageIndex = Math.min(Math.max(pageNumber - 1, 0), doc.getPageCount() - 1);
      const page = doc.getPage(pageIndex);
      const { width, height } = page.getSize();
      const x = (pos.x / 100) * width;
      const signW = (pos.w / 100) * width;

      if (signature) {
        const bytes = await signature.arrayBuffer();
        const image = signature.type.includes("png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const signH = signW * (image.height / image.width);
        const y = height - (pos.y / 100) * height - signH;
        page.drawImage(image, { x, y, width: signW, height: signH });
      } else {
        const font = await doc.embedFont(StandardFonts.TimesRomanItalic);
        const size = Math.max(18, Math.min(72, signW / Math.max(1, overlayText.length * 0.32)));
        const y = height - (pos.y / 100) * height - size;
        page.drawText(overlayText, { x, y, size, font, color: rgb(0.08, 0.14, 0.45) });
      }

      setProgress(80);
      const blob = new Blob([await doc.save() as BlobPart], { type: "application/pdf" });
      const name = pdf.name.replace(/\.pdf$/i, "") + "-signed.pdf";
      setResult({ blob, name });
      setProgress(100);
      logHistory({ tool_slug: "sign-pdf", tool_name: "Sign PDF", file_names: [pdf.name, signature?.name].filter(Boolean) as string[], output_name: name, output_size: blob.size, blob });
      toast.success("PDF signed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign this PDF.");
    } finally { setWorking(false); }
  };

  if (result) return <ResultPanel filename={result.name} blob={result.blob} onReset={() => { setResult(null); setPdfFiles([]); setSignatureFiles([]); setPages([]); setProgress(0); }} />;

  return (
    <div className="space-y-6">
      <FileDropzone files={pdfFiles} setFiles={setPdfFiles} accept={{ "application/pdf": [".pdf"] }} multiple={false} label="Upload the PDF you want to sign" />

      {pdf && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Move className="h-4 w-4 shrink-0 text-muted-foreground" />
                <h2 className="truncate text-sm font-semibold">Drag your signature onto the page</h2>
              </div>
              <Input className="h-9 w-24" type="number" min={1} max={Math.max(1, pages.length)} value={pageNumber} onChange={(e) => setPageNumber(Math.min(Math.max(+e.target.value || 1, 1), Math.max(1, pages.length)))} />
            </div>
            {previewLoading && <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Rendering PDF…</div>}
            {selectedPage && (
              <div
                className="relative mx-auto max-h-[72vh] w-full max-w-3xl overflow-auto rounded-lg bg-white"
                onPointerMove={(e) => { if (dragRef.current) updateFromPointer(e.clientX, e.clientY, e.currentTarget); }}
                onPointerUp={() => { dragRef.current = null; }}
                onPointerCancel={() => { dragRef.current = null; }}
              >
                <div className="relative">
                  <img src={selectedPage.dataUrl} alt={`Page ${selectedPage.pageNumber} preview`} className="h-auto w-full select-none" draggable={false} />
                  <div
                    className="absolute cursor-grab touch-none rounded border-2 border-primary bg-primary/10 p-1 active:cursor-grabbing"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.w}%` }}
                    onPointerDown={(e) => {
                      const target = e.currentTarget.getBoundingClientRect();
                      dragRef.current = { dx: e.clientX - target.left, dy: e.clientY - target.top };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                  >
                    {signatureUrl ? <img src={signatureUrl} alt="Signature preview" className="h-auto w-full select-none" draggable={false} /> : <div className="whitespace-nowrap font-serif text-xl italic text-blue-950">{overlayText}</div>}
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-5">
            <div>
              <Label className="mb-2 flex items-center gap-2"><Upload className="h-4 w-4" /> Signature image</Label>
              <FileDropzone files={signatureFiles} setFiles={setSignatureFiles} accept={{ "image/*": [".jpg", ".jpeg", ".png"] }} multiple={false} label="Upload signature" hint="PNG or JPG works best" />
            </div>
            <div>
              <Label>Or type signature</Label>
              <Input value={typedSignature} onChange={(e) => setTypedSignature(e.target.value)} placeholder="Your name" className="mt-1.5" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>Signature size</Label><span className="text-sm font-semibold">{pos.w}%</span></div>
              <Slider value={[pos.w]} min={10} max={70} step={1} onValueChange={([w]) => setPos((p) => ({ ...p, w, x: Math.min(p.x, 100 - w) }))} />
            </div>
          </aside>
        </div>
      )}

      {working && <Progress value={progress} />}
      <div className="flex justify-center">
        <Button size="lg" onClick={run} disabled={working || !pdf} className="bg-cta border-0 px-10 text-white hover:opacity-90">
          {working ? "Signing…" : "Apply signature"}
        </Button>
      </div>
    </div>
  );
}