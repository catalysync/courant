"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ListVideoIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime, requestSeek } from "@/lib/playback-time";

interface ChaptersSectionProps {
  videoId: string;
}

export const ChaptersSection = ({ videoId }: ChaptersSectionProps) => {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <ChaptersSectionSuspense videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const ChaptersSectionSuspense = ({ videoId }: ChaptersSectionProps) => {
  const [chapters] = trpc.ai.getChapters.useSuspenseQuery({ videoId });
  if (!chapters.length) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-2">
        <ListVideoIcon className="size-4 text-muted-foreground" />
        <h2 className="text-base font-bold">Chapters</h2>
      </div>
      <div className="flex flex-col">
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            onClick={() => requestSeek(chapter.startSec)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left transition-colors"
          >
            <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0">
              {formatTime(chapter.startSec)}
            </span>
            <span className="text-sm truncate">{chapter.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};