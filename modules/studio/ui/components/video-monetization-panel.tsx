"use client";

import { Suspense, useState } from "react";
import { toast } from "sonner";
import { CircleDollarSignIcon } from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const MONETIZATION_TYPES = ["free", "rental", "purchase", "membership"] as const;
type MonetizationType = (typeof MONETIZATION_TYPES)[number];

const MONETIZATION_LABELS: Record<MonetizationType, string> = {
  free: "Free",
  rental: "Rental",
  purchase: "Purchase",
  membership: "Membership",
};

interface VideoMonetizationPanelProps {
  videoId: string;
}

export const VideoMonetizationPanel = ({ videoId }: VideoMonetizationPanelProps) => {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ErrorBoundary fallback={<p>Error...</p>}>
        <VideoMonetizationPanelSuspense videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const VideoMonetizationPanelSuspense = ({ videoId }: VideoMonetizationPanelProps) => {
  const utils = trpc.useUtils();
  const [video] = trpc.studio.getOne.useSuspenseQuery({ id: videoId });

  const [monetizationType, setMonetizationType] = useState<MonetizationType>(
    toMonetizationType(video.monetizationType),
  );
  const [priceDollars, setPriceDollars] = useState(
    video.priceCents ? (video.priceCents / 100).toFixed(2) : "0.00",
  );

  const setMonetization = trpc.payments.setVideoMonetization.useMutation({
    onSuccess: () => {
      utils.studio.getOne.invalidate({ id: videoId });
      utils.payments.getVideoAccess.invalidate({ videoId });
      toast.success("Monetization saved");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const onSave = () => {
    const dollars = Number.parseFloat(priceDollars);
    const priceCents = Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
    setMonetization.mutate({ videoId, monetizationType, priceCents });
  };

  return (
    <div className="flex flex-col gap-y-5">
      <div className="flex items-center gap-2">
        <CircleDollarSignIcon className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Monetization</h2>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="monetization-type">Monetization type</Label>
        <Select
          value={monetizationType}
          onValueChange={(value) => setMonetizationType(value as MonetizationType)}
        >
          <SelectTrigger id="monetization-type" className="w-full">
            <SelectValue placeholder="Select monetization type" />
          </SelectTrigger>
          <SelectContent>
            {MONETIZATION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {MONETIZATION_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {monetizationType !== "free" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="monetization-price">Price (USD)</Label>
          <Input
            id="monetization-price"
            type="number"
            min="0"
            step="0.01"
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {monetizationType === "membership"
              ? "Viewers with an active channel membership can watch."
              : monetizationType === "rental"
                ? "Viewers can rent this video for 72 hours."
                : "Viewers pay once to watch forever."}
          </p>
        </div>
      )}

      <Button type="button" onClick={onSave} disabled={setMonetization.isPending}>
        {setMonetization.isPending ? "Saving…" : "Save monetization"}
      </Button>
    </div>
  );
};

function toMonetizationType(value: string | null | undefined): MonetizationType {
  return (MONETIZATION_TYPES as readonly string[]).includes(value ?? "")
    ? (value as MonetizationType)
    : "free";
}