import {
  Merge, Scissors, Minimize2, Image as ImageIcon, Maximize2, FileImage,
  FileText, FileCheck, RotateCw, Stamp, ListOrdered, Crop, Lock, Unlock,
  Eraser, PenTool, FileSpreadsheet, Presentation, Globe, Sparkles, Wand2,
  Eraser as EraserIcon, Palette, ImagePlus, Shuffle, ArrowDownToLine,
  type LucideIcon,
} from "lucide-react";

export type ToolCategory = "pdf" | "image" | "convert" | "ai";

export interface Tool {
  slug: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: LucideIcon;
  section: string;
}

export const TOOLS: Tool[] = [
  { slug: "merge-pdf", name: "Merge PDF", description: "Combine PDFs into one file in your preferred order.", category: "pdf", icon: Merge, section: "Organize" },
  { slug: "split-pdf", name: "Split PDF", description: "Extract a page range or split into separate PDFs.", category: "pdf", icon: Scissors, section: "Organize" },
  { slug: "compress-pdf", name: "Compress PDF", description: "Reduce PDF file size while keeping the best quality.", category: "pdf", icon: Minimize2, section: "Optimize" },
  { slug: "jpg-to-pdf", name: "JPG to PDF", description: "Convert images to PDF — set orientation and margin.", category: "convert", icon: FileImage, section: "Convert to PDF" },
  { slug: "resize-image", name: "Resize Image", description: "Custom size or social media presets, batch ZIP download.", category: "image", icon: Maximize2, section: "Resize & Convert" },
  { slug: "compress-image", name: "Compress Image", description: "Shrink JPG, PNG and WebP with a quality slider.", category: "image", icon: ImageIcon, section: "Optimize" },

  { slug: "remove-pages", name: "Remove Pages", description: "Visually select pages to delete from your PDF.", category: "pdf", icon: Eraser, section: "Organize" },
  { slug: "organize-pdf", name: "Organize PDF", description: "Drag and rearrange the pages of your PDF.", category: "pdf", icon: Shuffle, section: "Organize" },
  { slug: "repair-pdf", name: "Repair PDF", description: "Try to recover a damaged PDF file.", category: "pdf", icon: FileCheck, section: "Optimize" },
  { slug: "ocr-pdf", name: "OCR PDF", description: "Make scanned PDFs searchable with a text layer.", category: "ai", icon: Sparkles, section: "Optimize" },
  { slug: "word-to-pdf", name: "Word to PDF", description: "Convert DOCX documents into PDF.", category: "convert", icon: FileText, section: "Convert to PDF" },
  { slug: "powerpoint-to-pdf", name: "PowerPoint to PDF", description: "Convert PPTX slides into a PDF.", category: "convert", icon: Presentation, section: "Convert to PDF" },
  { slug: "excel-to-pdf", name: "Excel to PDF", description: "Convert XLSX spreadsheets into PDF.", category: "convert", icon: FileSpreadsheet, section: "Convert to PDF" },
  { slug: "html-to-pdf", name: "HTML to PDF", description: "Convert any webpage URL into a PDF.", category: "convert", icon: Globe, section: "Convert to PDF" },
  { slug: "pdf-to-jpg", name: "PDF to JPG", description: "Turn each page of a PDF into a JPG image.", category: "convert", icon: FileImage, section: "Convert from PDF" },
  { slug: "pdf-to-word", name: "PDF to Word", description: "Convert PDF documents into editable DOCX.", category: "convert", icon: FileText, section: "Convert from PDF" },
  { slug: "pdf-to-powerpoint", name: "PDF to PowerPoint", description: "Convert PDF into editable PPTX slides.", category: "convert", icon: Presentation, section: "Convert from PDF" },
  { slug: "pdf-to-excel", name: "PDF to Excel", description: "Pull data straight from PDF into spreadsheets.", category: "convert", icon: FileSpreadsheet, section: "Convert from PDF" },
  { slug: "rotate-pdf", name: "Rotate PDF", description: "Rotate one or all pages of your PDF.", category: "pdf", icon: RotateCw, section: "Edit" },
  { slug: "watermark-pdf", name: "Add Watermark", description: "Add a text or image watermark to your PDF.", category: "pdf", icon: Stamp, section: "Edit" },
  { slug: "page-numbers", name: "Add Page Numbers", description: "Insert page numbers anywhere in your PDF.", category: "pdf", icon: ListOrdered, section: "Edit" },
  { slug: "crop-pdf", name: "Crop PDF", description: "Crop a region of your PDF pages.", category: "pdf", icon: Crop, section: "Edit" },
  { slug: "protect-pdf", name: "Protect PDF", description: "Encrypt your PDF with a password.", category: "pdf", icon: Lock, section: "Edit" },
  { slug: "unlock-pdf", name: "Unlock PDF", description: "Remove password protection from a PDF.", category: "pdf", icon: Unlock, section: "Edit" },
  { slug: "redact-pdf", name: "Redact PDF", description: "Black out sensitive content permanently.", category: "pdf", icon: EraserIcon, section: "Edit" },
  { slug: "sign-pdf", name: "Sign PDF", description: "Draw, type or upload your signature.", category: "pdf", icon: PenTool, section: "Edit" },

  { slug: "convert-image", name: "Convert Image", description: "JPG ↔ PNG ↔ WebP, HEIC to JPG and more.", category: "image", icon: ImagePlus, section: "Resize & Convert" },
  { slug: "bulk-compress", name: "Bulk Compress", description: "Compress many images at once, download ZIP.", category: "image", icon: ArrowDownToLine, section: "Optimize" },
  { slug: "photo-enhancer", name: "Photo Enhancer", description: "AI auto-enhance, upscale, denoise and sharpen.", category: "ai", icon: Wand2, section: "Enhance" },
  { slug: "background-remover", name: "Background Remover", description: "Cut out backgrounds for transparent PNGs.", category: "ai", icon: Sparkles, section: "Enhance" },
  { slug: "colorize-photo", name: "Colorize Photo", description: "Add realistic color to black and white photos.", category: "ai", icon: Palette, section: "Enhance" },
  { slug: "restore-photo", name: "Restore Old Photo", description: "Repair scratches, fading and tears with AI.", category: "ai", icon: Sparkles, section: "Enhance" },
  { slug: "crop-image", name: "Crop Image", description: "Freeform crop or fixed aspect ratios.", category: "image", icon: Crop, section: "Edit" },
  { slug: "rotate-image", name: "Rotate & Flip Image", description: "Rotate and flip your images.", category: "image", icon: RotateCw, section: "Edit" },
  { slug: "watermark-image", name: "Watermark Image", description: "Add text or logo watermark to images.", category: "image", icon: Stamp, section: "Edit" },
  { slug: "annotate-image", name: "Annotate Image", description: "Draw, add text, arrows and shapes.", category: "image", icon: PenTool, section: "Edit" },
];

export const getTool = (slug: string) => TOOLS.find((t) => t.slug === slug);

export const CATEGORY_LABEL: Record<ToolCategory, string> = {
  pdf: "PDF",
  image: "Image",
  convert: "Convert",
  ai: "AI / Enhance",
};
