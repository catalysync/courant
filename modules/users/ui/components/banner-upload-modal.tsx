"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Loader2Icon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/responsive-modal";

interface BannerUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BannerUploadModal = ({ open, onOpenChange }: BannerUploadModalProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();

  const update = trpc.users.updateBanner.useMutation({
    onSuccess: () => {
      utils.users.getOne.invalidate();
      toast.success("Banner updated");
      onOpenChange(false);
    },
    onError: () => toast.error("Something went wrong"),
  });

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "content-type": file.type, "x-upload-kind": "banner" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url, key } = (await res.json()) as { url: string; key: string };
      update.mutate({ url, key });
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <ResponsiveModal title="Upload channel banner" open={open} onOpenChange={onOpenChange}>
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
        <div className="flex items-center justify-center gap-2 rounded-full bg-muted h-24 w-24">
          <ImageIcon className="size-10 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Recommended size: 2560 × 423 px</p>
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