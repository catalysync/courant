"use client";

import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { SearchIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime, requestSeek } from "@/lib/playback-time";

interface VideoSearchSectionProps {
  videoId: string;
}

export const VideoSearchSection = ({ videoId }: VideoSearchSectionProps) => {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <VideoSearchSectionInner videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const VideoSearchSectionInner = ({ videoId }: VideoSearchSectionProps) => {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isFetching } = trpc.ai.searchTranscript.useQuery(
    { videoId, query: submitted },
    { enabled: submitted.length > 0 },
  );

  const items = data?.items ?? [];

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-2">
        <SearchIcon className="size-4 text-muted-foreground" />
        <h2 className="text-base font-bold">Search in video</h2>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the transcript…"
          className="max-w-md"
        />
        <Button type="submit" variant="secondary" disabled={!query.trim() || isFetching}>
          {isFetching ? "Searching…" : "Search"}
        </Button>
      </form>

      {submitted.length > 0 && !isFetching && (
        <div className="mt-3 flex flex-col">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches found in this video.</p>
          ) : (
            items.map((item, i) => (
              <button
                key={`${item.startSec}-${i}`}
                type="button"
                onClick={() => requestSeek(item.startSec)}
                className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left transition-colors"
              >
                <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0 mt-0.5">
                  {formatTime(item.startSec)}
                </span>
                <span className="text-sm line-clamp-2">{item.snippet}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};