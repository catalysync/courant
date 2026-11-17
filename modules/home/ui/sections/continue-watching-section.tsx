"use client";

import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { HistoryIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { useSession } from "@/lib/auth-client";
import { formatTime } from "@/lib/playback-time";

/** "Continue watching" rail — videos the viewer started but didn't finish. */
export const ContinueWatchingSection = () => {
  const { data: session, isPending } = useSession();
  if (isPending || !session?.user) return null;

  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <ContinueWatchingSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const ContinueWatchingSectionSuspense = () => {
  const [data] = trpc.videoViews.getContinueWatching.useSuspenseQuery({ limit: 20 });
  if (!data.items.length) return null;

  return (
    <section className="flex flex-col gap-y-3">
      <div className="flex items-center gap-2">
        <HistoryIcon className="size-4 text-muted-foreground" />
        <h2 className="text-base font-bold">Continue watching</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {data.items.map((v) => {
          const pct = v.totalSeconds ? Math.min(100, Math.round((v.resumeSeconds / v.totalSeconds) * 100)) : 0;
          return (
            <Link
              key={v.id}
              href={`/videos/${v.id}`}
              className="group w-56 shrink-0 rounded-xl border overflow-hidden hover:bg-muted transition-colors"
            >
              <div className="relative aspect-video bg-muted">
                {v.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/70 px-2 py-1">
                  <span className="text-[11px] text-white tabular-nums">
                    {formatTime(v.resumeSeconds)} / {formatTime(v.totalSeconds)}
                  </span>
                  <span className="text-[11px] text-white tabular-nums">{pct}%</span>
                </div>
                <div className="absolute bottom-0 left-0 h-0.5 w-full bg-white/30">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="p-2">
                <p className="text-sm font-medium truncate">{v.title}</p>
                <p className="text-xs text-muted-foreground truncate">{v.user?.name ?? ""}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};