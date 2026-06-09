import { createFileRoute, notFound } from "@tanstack/react-router";
import { getTool } from "@/lib/tools";
import { ToolPageShell } from "@/components/site/ToolPageShell";
import { MergePdfTool } from "@/tools/MergePdfTool";
import { SplitPdfTool } from "@/tools/SplitPdfTool";
import { CompressPdfTool } from "@/tools/CompressPdfTool";
import { JpgToPdfTool } from "@/tools/JpgToPdfTool";
import { ResizeImageTool } from "@/tools/ResizeImageTool";
import { CompressImageTool } from "@/tools/CompressImageTool";
import { ComingSoon } from "@/tools/ComingSoon";

export const Route = createFileRoute("/tools/$slug")({
  loader: ({ params }) => {
    const tool = getTool(params.slug);
    if (!tool) throw notFound();
    return { tool };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.tool.name} — PixelForge` },
      { name: "description", content: loaderData.tool.description },
    ] : [],
  }),
  component: ToolRoute,
  notFoundComponent: () => <div className="p-10 text-center">Tool not found.</div>,
  errorComponent: ({ error }) => <div className="p-10 text-center text-destructive">{error.message}</div>,
});

const REGISTRY: Record<string, React.ComponentType> = {
  "merge-pdf": MergePdfTool,
  "split-pdf": SplitPdfTool,
  "compress-pdf": CompressPdfTool,
  "jpg-to-pdf": JpgToPdfTool,
  "resize-image": ResizeImageTool,
  "compress-image": CompressImageTool,
};

function ToolRoute() {
  const { tool } = Route.useLoaderData();
  const Comp = REGISTRY[tool.slug] ?? ComingSoon;
  return (
    <ToolPageShell tool={tool}>
      <Comp />
    </ToolPageShell>
  );
}
