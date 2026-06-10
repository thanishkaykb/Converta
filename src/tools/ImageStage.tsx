import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Move, RotateCcw, ZoomIn } from "lucide-react";

export interface ImageStageSettings {
  panX: number;
  panY: number;
  zoom: number;
}

export const defaultStageSettings: ImageStageSettings = { panX: 0, panY: 0, zoom: 1 };

export function ImageStage({
  file,
  aspectW,
  aspectH,
  settings,
  onChange,
  overlayLabel = "Output frame",
}: {
  file: File;
  aspectW: number;
  aspectH: number;
  settings: ImageStageSettings;
  onChange: (settings: ImageStageSettings) => void;
  overlayLabel?: string;
}) {
  const [url, setUrl] = useState("");
  const dragging = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const aspect = useMemo(() => `${aspectW} / ${aspectH}`, [aspectW, aspectH]);

  const startDrag = (clientX: number, clientY: number) => {
    dragging.current = { x: clientX, y: clientY, panX: settings.panX, panY: settings.panY };
  };

  const moveDrag = (clientX: number, clientY: number, width: number, height: number) => {
    if (!dragging.current) return;
    const dx = ((clientX - dragging.current.x) / Math.max(1, width)) * 100;
    const dy = ((clientY - dragging.current.y) / Math.max(1, height)) * 100;
    onChange({ ...settings, panX: dragging.current.panX + dx, panY: dragging.current.panY + dy });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="flex items-center gap-2"><Move className="h-4 w-4" /> Preview & crop area</Label>
          <p className="text-xs text-muted-foreground mt-1">Drag the image to choose what stays inside the final frame.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(defaultStageSettings)}>
          <RotateCcw className="h-4 w-4 mr-2" /> Reset
        </Button>
      </div>
      <div
        className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-lg border border-primary/40 bg-background touch-none select-none"
        style={{ aspectRatio: aspect }}
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); startDrag(e.clientX, e.clientY); }}
        onPointerMove={(e) => moveDrag(e.clientX, e.clientY, e.currentTarget.clientWidth, e.currentTarget.clientHeight)}
        onPointerUp={() => { dragging.current = null; }}
        onPointerCancel={() => { dragging.current = null; }}
      >
        {url && (
          <img
            src={url}
            alt="Selected file preview"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover will-change-transform"
            style={{ transform: `translate(${settings.panX}%, ${settings.panY}%) scale(${settings.zoom})` }}
          />
        )}
        <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-foreground/80" />
        <div className="pointer-events-none absolute left-3 top-3 rounded bg-background/80 px-2 py-1 text-xs font-medium text-foreground backdrop-blur">
          {overlayLabel}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[120px_1fr_48px] sm:items-center">
        <Label className="flex items-center gap-2"><ZoomIn className="h-4 w-4" /> Zoom</Label>
        <Slider value={[settings.zoom]} min={1} max={3} step={0.05} onValueChange={([zoom]) => onChange({ ...settings, zoom })} />
        <span className="text-sm font-semibold tabular-nums">{settings.zoom.toFixed(2)}×</span>
      </div>
    </div>
  );
}

export async function drawImageToCanvas(file: File, width: number, height: number, settings: ImageStageSettings = defaultStageSettings) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const base = Math.max(width / image.naturalWidth, height / image.naturalHeight) * settings.zoom;
  const drawW = image.naturalWidth * base;
  const drawH = image.naturalHeight * base;
  const dx = (width - drawW) / 2 + (settings.panX / 100) * width;
  const dy = (height - drawH) / 2 + (settings.panY / 100) * height;
  ctx.drawImage(image, dx, dy, drawW, drawH);
  URL.revokeObjectURL(image.src);
  return canvas;
}

export async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality = 0.92): Promise<Blob> {
  return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), type, quality));
}