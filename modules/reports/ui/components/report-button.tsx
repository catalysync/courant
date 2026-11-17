"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FlagIcon, Loader2Icon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "hateful_or_abusive", label: "Hateful or abusive" },
  { value: "explicit_content", label: "Explicit content" },
  { value: "copyright", label: "Copyright" },
  { value: "misleading", label: "Misleading" },
  { value: "other", label: "Other" },
] as const;

interface ReportButtonProps {
  videoId?: string;
  commentId?: string;
  targetUserId?: string;
}

export const ReportButton = ({ videoId, commentId, targetUserId }: ReportButtonProps) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const create = trpc.reports.create.useMutation({
    onSuccess: () => {
      toast.success("Report submitted — thanks for helping keep Courant safe");
      setOpen(false);
      setReason(null);
    },
    onError: (e) => toast.error(e.message || "Could not submit report"),
  });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start rounded-none px-2"
        onClick={() => setOpen(true)}
      >
        <FlagIcon className="size-4 mr-2" />
        Report
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Report this content</DialogTitle>
            <DialogDescription>Why are you reporting this?</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  reason === r.value ? "border-primary bg-primary/10" : "hover:bg-muted",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={!reason || create.isPending}
              onClick={() => {
                if (reason) {
                  create.mutate({ videoId, commentId, targetUserId, reason: reason as never });
                }
              }}
            >
              {create.isPending && <Loader2Icon className="size-4 mr-2 animate-spin" />}
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};