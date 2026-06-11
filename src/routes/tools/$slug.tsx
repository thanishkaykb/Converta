import { createFileRoute } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { getTool } from "@/lib/tools";
import { ToolPageShell } from "@/components/site/ToolPageShell";
import { MergePdfTool } from "@/tools/MergePdfTool";
import { SplitPdfTool } from "@/tools/SplitPdfTool";
import { CompressPdfTool } from "@/tools/CompressPdfTool";
import { JpgToPdfTool } from "@/tools/JpgToPdfTool";
import { ResizeImageTool } from "@/tools/ResizeImageTool";
import { CompressImageTool } from "@/tools/CompressImageTool";
import { UniversalTool } from "@/tools/UniversalTool";

export const Route = createFileRoute("/tools/$slug")({
  head: ({ params }) => {
    const tool = getTool(params.slug);
    return {
      meta: [
        { title: `${tool?.name ?? "Tool"} — Converta` },
        { name: "description", content: tool?.description ?? "Process PDFs and images privately in your browser with Converta." },
      ],
    };
  },
  component: ToolRoute,
  notFoundComponent: () => <div className="p-10 text-center">Tool not found.</div>,
  errorComponent: ({ error }) => <div className="p-10 text-center text-destructive">{error.message}</div>,
});

const REGISTRY: Record<string, ComponentType> = {
  "merge-pdf": MergePdfTool,
  "split-pdf": SplitPdfTool,
  "compress-pdf": CompressPdfTool,
  "jpg-to-pdf": JpgToPdfTool,
  "resize-image": ResizeImageTool,
  "compress-image": CompressImageTool,
};

function ToolRoute() {
  const { slug } = Route.useParams();
  const tool = getTool(slug);

  if (!tool) {
    return <div className="p-10 text-center">Tool not found.</div>;
  }

  const Comp = REGISTRY[tool.slug];
  return (
    <ToolPageShell tool={tool}>
      {Comp ? <Comp /> : <UniversalTool tool={tool} />}
    </ToolPageShell>
  );
}
