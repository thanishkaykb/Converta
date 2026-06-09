import { useDropzone, type Accept } from "react-dropzone";
import { UploadCloud, X, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  files: File[];
  setFiles: (files: File[]) => void;
  accept?: Accept;
  multiple?: boolean;
  label?: string;
  hint?: string;
}

export function FileDropzone({ files, setFiles, accept, multiple = true, label, hint }: Props) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    multiple,
    onDrop: (accepted) => {
      setFiles(multiple ? [...files, ...accepted] : accepted);
    },
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all",
          "bg-card/50 hover:bg-card hover:border-primary",
          isDragActive ? "border-primary bg-primary/10" : "border-border",
        )}
      >
        <input {...getInputProps()} />
        <div className="grid place-items-center gap-3">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-cta shadow-[var(--shadow-glow-violet)]">
            <UploadCloud className="h-8 w-8 text-white" />
          </div>
          <div className="font-display text-xl font-semibold">
            {label ?? (isDragActive ? "Drop your files here" : "Click to upload or drag files here")}
          </div>
          <div className="text-sm text-muted-foreground">{hint ?? "No file size limit · processed locally in your browser"}</div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-muted">
                <FileIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">{f.name}</div>
                <div className="text-xs text-muted-foreground">{formatBytes(f.size)}</div>
              </div>
              <Button
                size="icon" variant="ghost"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
