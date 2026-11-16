"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Loader2Icon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/responsive-modal";

interface ThumbnailUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
}

export const ThumbnailUploadModal = ({
  open,
  onOpenChange,
  videoId,
}: ThumbnailUploadModalProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();

  const update = trpc.videos.updateThumbnail.useMutation({
    onSuccess: () => {
      utils.studio.getOne.invalidate({ id: videoId });
      utils.videos.getOne.invalidate({ id: videoId });
      toast.success("Thumbnail updated");
      onOpenChange(false);
    },
    onError: () => toast.error("Something went wrong"),
  });

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "content-type": file.type, "x-upload-kind": "thumbnail" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url, key } = (await res.json()) as { url: string; key: string };
      update.mutate({ videoId, url, key });
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <ResponsiveModal title="Upload custom thumbnail" open={open} onOpenChange={onOpenChange}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex items-center justify-center gap-2 rounded-xl bg-muted h-28 w-48">
          <ImageIcon className="size-10 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Recommended size: 1280 × 720 px</p>
        <Button
          type="button"
          disabled={uploading || update.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {uploading || update.isPending ? (
            <Loader2Icon className="size-4 mr-2 animate-spin" />
          ) : (
            <ImageIcon className="size-4 mr-2" />
          )}
          Select image
        </Button>
      </div>
    </ResponsiveModal>
  );
};