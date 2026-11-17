"use client";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { cn, formatDuration } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/_app";
import { inferRouterOutputs } from "@trpc/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

type FeaturedVideo =
  inferRouterOutputs<AppRouter>["discovery"]["getFeatured"][number];

const AUTO_ADVANCE_MS = 6000;

export const FeaturedSection = () => {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <FeaturedSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const FeaturedSectionSuspense = () => {
  const [featured] = trpc.discovery.getFeatured.useSuspenseQuery();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = featured.length;

  // Keep the index in range if the featured list shrinks.
  useEffect(() => {
    if (count > 0 && index >= count) {
      setIndex(count - 1);
    }
  }, [count, index]);

  // Auto-advance every 6s, pausing while hovered.
  useEffect(() => {
    if (count <= 1 || paused) {
      return;
    }

    const interval = setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, AUTO_ADVANCE_MS);

    return () => clearInterval(interval);
  }, [count, paused]);

  const goTo = useCallback(
    (next: number) => {
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  if (count === 0) {
    return null;
  }

  const video = featured[index];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight">Featured</h2>

      <div
        className="group relative overflow-hidden rounded-2xl border border-border bg-card"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <Link
          prefetch
          href={`/videos/${video.id}`}
          aria-label={video.title}
          className="relative block aspect-video w-full sm:aspect-[21/9]"
        >
          <Image
            src={video.thumbnailUrl ?? "/next.svg"}
            alt={video.title}
            fill
            priority
            sizes="(max-width: 640px) 100vw, 80vw"
            className="object-cover"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {/* Duration badge */}
          <div className="absolute right-3 top-3 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatDuration(video.duration)}
          </div>

          {/* Title + channel */}
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 pr-14 sm:p-6 sm:pr-20">
            <UserAvatar
              size="lg"
              imageUrl={video.user.image}
              name={video.user.name}
              className="shrink-0 ring-2 ring-white/20"
            />
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-white sm:text-2xl">
                {video.title}
              </h3>
              <p className="mt-1 truncate text-sm font-medium text-white/80">
                {video.user.name}
              </p>
            </div>
          </div>
        </Link>

        {/* Prev / next arrows */}
        {count > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goTo(index - 1)}
              aria-label="Previous featured video"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/70 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goTo(index + 1)}
              aria-label="Next featured video"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/70 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ChevronRight className="size-5" />
            </Button>
          </>
        )}

        {/* Dot indicators */}
        {count > 1 && (
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5 sm:bottom-6 sm:right-6">
            {featured.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to featured video ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index
                    ? "w-5 bg-white"
                    : "w-1.5 bg-white/50 hover:bg-white/70",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};