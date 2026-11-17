"use client";

import { useEffect, useRef } from "react";
import { hlsUrl } from "@/lib/stream-urls";
import { setPlaybackTime, setIsPlaying, subscribeSeek, subscribeIsPlaying } from "@/lib/playback-time";

interface VideoPlayerProps {
  uid?: string | null | undefined;
  /** Direct HLS source; overrides the uid-derived URL (used after password verify). */
  src?: string | null | undefined;
  thumbnailUrl?: string | null | undefined;
  autoPlay?: boolean;
  onPlay?: () => void;
  onTimeUpdate?: (current: number, total: number) => void;
  className?: string;
}

/**
 * Cloudflare Stream player. Native HLS on Safari; hls.js everywhere else. Full control over
 * autoplay / play events (drives view counting).
 */
export const VideoPlayer = ({
  uid,
  src,
  thumbnailUrl,
  autoPlay,
  onPlay,
  onTimeUpdate,
  className,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Report the live playback time (for timecoded comments) and accept seek
  // requests from timestamp chips.
  useEffect(() => {
    return subscribeSeek((t) => {
      const video = videoRef.current;
      if (video && Number.isFinite(t)) video.currentTime = t;
    });
  }, []);

  // Accept play/pause requests (from watch-party sync).
  useEffect(() => {
    return subscribeIsPlaying((playing) => {
      const video = videoRef.current;
      if (!video) return;
      if (playing) void video.play().catch(() => {});
      else video.pause();
    });
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const resolvedSrc = src ?? (uid ? hlsUrl(uid) : null);
    if (!resolvedSrc) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = resolvedSrc;
      return;
    }

    // hls.js (~350KB decoded) is only needed for non-Safari HLS playback, so
    // dynamic-import it: it stays out of the initial bundle and code-splits
    // onto the watch page only.
    let cancelled = false;
    let hls: InstanceType<typeof import("hls.js").default> | null = null;
    import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return;
        hls = new Hls({ enableWorker: true });
        hls.loadSource(resolvedSrc);
        hls.attachMedia(video);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [uid, src]);

  if (!uid && !src) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black text-muted-foreground text-sm">
        Video is still processing…
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className={className ?? "w-full h-full object-contain"}
      poster={thumbnailUrl ?? undefined}
      autoPlay={autoPlay}
      controls
      playsInline
      preload={autoPlay ? "auto" : "metadata"}
      onPlay={() => {
        setIsPlaying(true);
        onPlay?.();
      }}
      onPause={() => setIsPlaying(false)}
      onTimeUpdate={(e) => {
        const el = e.currentTarget;
        setPlaybackTime(el.currentTime);
        onTimeUpdate?.(el.currentTime, el.duration || 0);
      }}
    />
  );
};