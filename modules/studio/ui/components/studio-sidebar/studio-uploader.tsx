"use client";

import { Button } from "@/components/ui/button";
import { UploadIcon, CheckCircle2Icon, AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface StudioUploaderProps {
  endpoint?: string | null;
  onSuccess: () => void;
}

type UploadState = "idle" | "uploading" | "done" | "error";

/**
 * Uploads a file to a Cloudflare Stream direct-upload URL (TUS protocol) using tus-js-client.
 * Replaces the Mux uploader.
 */
export const StudioUploader = ({ endpoint, onSuccess }: StudioUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  const startUpload = useCallback(
    async (file: File) => {
      if (!endpoint) return;
      setState("uploading");
      setProgress(0);

      // tus-js-client is only needed for the upload flow; dynamic import keeps
      // it out of the initial bundle and code-splits onto the studio page.
      try {
        const tus = await import("tus-js-client");
        const upload = new tus.Upload(file, {
          endpoint,
          retryDelays: [0, 1000, 3000, 5000],
          chunkSize: 5 * 1024 * 1024,
          metadata: { filename: file.name, filetype: file.type },
          onProgress: (bytesUploaded, bytesTotal) => {
            const pct = bytesTotal ? Math.floor((bytesUploaded / bytesTotal) * 100) : 0;
            setProgress(pct);
          },
          onSuccess: () => {
            setState("done");
            onSuccess();
          },
          onError: () => {
            setState("error");
          },
        });
        upload.start();
      } catch {
        setState("error");
      }
    },
    [endpoint, onSuccess],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void startUpload(file);
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void startUpload(file);
  };

  if (state === "done") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10">
        <CheckCircle2Icon className="size-12 text-green-500" />
        <p className="text-sm text-muted-foreground">Upload complete — processing video…</p>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className="flex flex-col items-center gap-6 py-4"
    >
      <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={onSelect} />
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-full bg-muted h-32 w-32 transition-colors ${
          dragging ? "bg-accent" : ""
        }`}
      >
        <UploadIcon className="size-10 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-2 text-center">
        <p className="text-sm">Drag and drop a video file to upload</p>
        <p className="text-xs text-muted-foreground">
          Your videos will be private until you publish them
        </p>
      </div>

      {state === "uploading" && (
        <div className="w-full flex flex-col items-center gap-2">
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{progress}%</p>
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircleIcon className="size-4" />
          Upload failed
        </div>
      )}

      {state !== "uploading" && (
        <Button type="button" className="rounded-full" onClick={() => inputRef.current?.click()}>
          {state === "idle" ? (
            <>
              <UploadIcon className="size-4 mr-2" />
              Select file
            </>
          ) : (
            <Loader2Icon className="size-4 animate-spin" />
          )}
        </Button>
      )}
    </div>
  );
};