import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/60 mt-24">
      <div className="container mx-auto px-4 py-12 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-cta">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold">PixelForge</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Every tool for your PDFs and images — in one place. Free, fast, and private.
          </p>
        </div>
        <FooterCol title="PDF" items={["Merge PDF", "Split PDF", "Compress PDF", "JPG to PDF"]} />
        <FooterCol title="Image" items={["Resize Image", "Compress Image", "Background Remover", "Photo Enhancer"]} />
        <FooterCol title="Company" items={["About", "Pricing", "Privacy", "Terms"]} />
      </div>
      <div className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PixelForge. Files are processed in your browser — they never leave your device.
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="font-semibold mb-3 text-sm">{title}</div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((i) => <li key={i} className="hover:text-foreground transition cursor-pointer">{i}</li>)}
      </ul>
    </div>
  );
}
