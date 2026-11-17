"use client";

import { Suspense, useState } from "react";
import { toast } from "sonner";
import { SlidersHorizontalIcon } from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const END_SCREEN_TYPES = ["none", "link", "cta"] as const;
type EndScreenType = (typeof END_SCREEN_TYPES)[number];

const END_SCREEN_LABELS: Record<EndScreenType, string> = {
  none: "None",
  link: "Link",
  cta: "Call to action",
};

const MATURITY_RATINGS = ["general", "mature"] as const;
type MaturityRating = (typeof MATURITY_RATINGS)[number];

const MATURITY_LABELS: Record<MaturityRating, string> = {
  general: "General",
  mature: "Mature",
};

const AUDIO_QUALITIES = ["standard", "high"] as const;
type AudioQuality = (typeof AUDIO_QUALITIES)[number];

const AUDIO_QUALITY_LABELS: Record<AudioQuality, string> = {
  standard: "Standard",
  high: "High bitrate (320 kbps)",
};

interface VideoControlsPanelProps {
  videoId: string;
}

export const VideoControlsPanel = ({ videoId }: VideoControlsPanelProps) => {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ErrorBoundary fallback={<div className="py-8 text-center text-sm text-muted-foreground">Something went wrong</div>}>
        <VideoControlsPanelSuspense videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const VideoControlsPanelSuspense = ({ videoId }: VideoControlsPanelProps) => {
  const utils = trpc.useUtils();
  const [video] = trpc.studio.getOne.useSuspenseQuery({ id: videoId });

  const [requireEmail, setRequireEmail] = useState(video.requireEmail);
  const [allowDownload, setAllowDownload] = useState(video.allowDownload);
  const [maturityRating, setMaturityRating] = useState<MaturityRating>(
    toMaturityRating(video.maturityRating),
  );
  const [endScreenType, setEndScreenType] = useState<EndScreenType>(
    toEndScreenType(video.endScreenType),
  );
  const [endScreenUrl, setEndScreenUrl] = useState(video.endScreenUrl ?? "");
  const [endScreenCta, setEndScreenCta] = useState(video.endScreenCta ?? "");
  const [audioQuality, setAudioQuality] = useState<AudioQuality>(
    video.audioQuality === "high" ? "high" : "standard",
  );

  const update = trpc.videos.update.useMutation({
    onSuccess: () => {
      utils.studio.getOne.invalidate({ id: videoId });
      toast.success("Launch controls saved");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const onSave = () => {
    update.mutate({
      id: videoId,
      requireEmail,
      allowDownload,
      maturityRating,
      endScreenType,
      endScreenUrl:
        endScreenType === "none" ? null : endScreenUrl.trim() || null,
      endScreenCta:
        endScreenType === "none" ? null : endScreenCta.trim() || null,
      audioQuality,
    });
  };

  return (
    <div className="flex flex-col gap-y-5">
      <div className="flex items-center gap-2">
        <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Launch controls</h2>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="require-email">Require email to watch</Label>
          <p className="text-xs text-muted-foreground">
            Capture a viewer&apos;s email before playback
          </p>
        </div>
        <Switch
          id="require-email"
          checked={requireEmail}
          onCheckedChange={setRequireEmail}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="allow-download">Allow viewers to download</Label>
          <p className="text-xs text-muted-foreground">
            Show a download button on the player
          </p>
        </div>
        <Switch
          id="allow-download"
          checked={allowDownload}
          onCheckedChange={setAllowDownload}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="maturity-rating">Maturity rating</Label>
        <Select
          value={maturityRating}
          onValueChange={(value) => setMaturityRating(value as MaturityRating)}
        >
          <SelectTrigger id="maturity-rating" className="w-full">
            <SelectValue placeholder="Select maturity rating" />
          </SelectTrigger>
          <SelectContent>
            {MATURITY_RATINGS.map((rating) => (
              <SelectItem key={rating} value={rating}>
                {MATURITY_LABELS[rating]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="audio-quality">Audio quality</Label>
        <Select
          value={audioQuality}
          onValueChange={(value) => setAudioQuality(value as AudioQuality)}
        >
          <SelectTrigger id="audio-quality" className="w-full">
            <SelectValue placeholder="Select audio quality" />
          </SelectTrigger>
          <SelectContent>
            {AUDIO_QUALITIES.map((q) => (
              <SelectItem key={q} value={q}>
                {AUDIO_QUALITY_LABELS[q]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="end-screen-type">End screen</Label>
        <Select
          value={endScreenType}
          onValueChange={(value) => setEndScreenType(value as EndScreenType)}
        >
          <SelectTrigger id="end-screen-type" className="w-full">
            <SelectValue placeholder="Select end screen" />
          </SelectTrigger>
          <SelectContent>
            {END_SCREEN_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {END_SCREEN_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {endScreenType !== "none" && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="end-screen-url">End screen URL</Label>
            <Input
              id="end-screen-url"
              type="url"
              placeholder="https://example.com"
              value={endScreenUrl}
              onChange={(e) => setEndScreenUrl(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="end-screen-cta">CTA label</Label>
            <Input
              id="end-screen-cta"
              placeholder="Learn more"
              value={endScreenCta}
              onChange={(e) => setEndScreenCta(e.target.value)}
            />
          </div>
        </>
      )}

      <Button type="button" onClick={onSave} disabled={update.isPending}>
        {update.isPending ? "Saving…" : "Save launch controls"}
      </Button>
    </div>
  );
};

function toMaturityRating(value: string | null | undefined): MaturityRating {
  return (MATURITY_RATINGS as readonly string[]).includes(value ?? "")
    ? (value as MaturityRating)
    : "general";
}

function toEndScreenType(value: string | null | undefined): EndScreenType {
  return (END_SCREEN_TYPES as readonly string[]).includes(value ?? "")
    ? (value as EndScreenType)
    : "none";
}