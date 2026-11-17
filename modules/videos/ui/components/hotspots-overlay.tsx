"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ExternalLinkIcon, MapPinIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { formatTime, requestSeek } from "@/lib/playback-time";

interface HotspotsOverlayProps {
  videoId: string;
}

export const HotspotsOverlay = ({ videoId }: HotspotsOverlayProps) => {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <HotspotsOverlayInner videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const HotspotsOverlayInner = ({ videoId }: HotspotsOverlayProps) => {
  const [hotspots] = trpc.interactive.getHotspots.useSuspenseQuery({ videoId });
  if (!hotspots.length) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <MapPinIcon className="size-4 text-muted-foreground" />
        <h2 className="text-base font-bold">Hotspots</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {hotspots.map((hotspot) => (
          <div
            key={hotspot.id}
            className="flex items-center overflow-hidden rounded-full border bg-card"
          >
            <button
              type="button"
              onClick={() => requestSeek(hotspot.startSec)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-muted transition-colors"
            >
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: hotspot.color ?? "#3b82f6" }}
              />
              <span className="text-muted-foreground tabular-nums">
                {formatTime(hotspot.startSec)}
              </span>
              <span className="font-medium">{hotspot.label}</span>
            </button>
            {hotspot.url && (
              <a
                href={hotspot.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center border-l px-2 py-1.5 text-muted-foreground hover:bg-muted transition-colors"
                title={hotspot.url}
              >
                <ExternalLinkIcon className="size-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};