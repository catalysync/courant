"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleDollarSignIcon, Loader2Icon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/responsive-modal";

interface TipButtonProps {
  toUserId: string;
  videoId: string;
}

export const TipButton = ({ toUserId, videoId }: TipButtonProps) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();

  const create = trpc.tips.create.useMutation({
    onSuccess: () => {
      utils.tips.getMany.invalidate({ direction: "received" });
      utils.tips.getMany.invalidate({ direction: "sent" });
      utils.tips.getLedger.invalidate();
      toast.success("Tip sent");
      setOpen(false);
      setAmount("");
      setNote("");
    },
    onError: (error) => {
      if (error.data?.code === "UNAUTHORIZED") {
        router.push("/sign-in");
        return;
      }
      toast.error(error.message || "Something went wrong");
    },
  });

  const onSubmit = () => {
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      toast.error("Enter an amount greater than 0");
      return;
    }
    const amountCents = Math.round(dollars * 100);
    if (amountCents < 1) {
      toast.error("Amount is too small");
      return;
    }
    create.mutate({
      toUserId,
      videoId,
      amountCents,
      note: note.trim() || null,
    });
  };

  return (
    <>
      <Button
        variant="secondary"
        className="rounded-full flex-none"
        onClick={() => setOpen(true)}
      >
        <CircleDollarSignIcon className="size-4" />
        Tip
      </Button>

      <ResponsiveModal title="Send a tip" open={open} onOpenChange={setOpen}>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tip-amount">Amount (USD)</Label>
            <Input
              id="tip-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="5.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tip-note">Note (optional)</Label>
            <Textarea
              id="tip-note"
              rows={3}
              maxLength={280}
              placeholder="Thanks for the great video!"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={create.isPending} onClick={onSubmit}>
              {create.isPending ? (
                <Loader2Icon className="size-4 mr-2 animate-spin" />
              ) : (
                <CircleDollarSignIcon className="size-4 mr-2" />
              )}
              Send tip
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </>
  );
};