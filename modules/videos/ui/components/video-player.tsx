"use client";

import { useEffect, useRef, useState } from "react";
import { hlsUrl } from "@/lib/stream-urls";
import {
  setPlaybackTime,
  setIsPlaying,
  subscribeSeek,
  subscribeIsPlaying,
  subscribePlaybackRate,
  requestPlaybackRate,
  getPlaybackRate,
} from "@/lib/playback-time";
import { cn } from "@/lib/utils";

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

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
  const [rate, setRate] = useState(1);

  // Apply playback-rate requests.
  useEffect(() => {
    return subscribePlaybackRate((r) => {
      const video = videoRef.current;
      if (video) video.playbackRate = r;
      setRate(r);
    });
  }, []);

  // Keyboard shortcuts (space/K play/pause, J/L seek 10s, arrows 5s, F fullscreen, M mute, ,/. speed).
  useEffect(() => {
    const cycleRate = (dir: number) => {
      const cur = getPlaybackRate();
      const idx = RATES.indexOf(cur);
      const next = RATES[(idx + dir + RATES.length) % RATES.length] ?? 1;
      requestPlaybackRate(next);
    };
    const onKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          if (video.paused) void video.play().catch(() => {});
          else video.pause();
          break;
        case "j":
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case "l":
          video.currentTime = video.currentTime + 10;
          break;
        case "arrowleft":
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case "arrowright":
          video.currentTime = video.currentTime + 5;
          break;
        case "f":
          if (document.fullscreenElement) void document.exitFullscreen();
          else video.requestFullscreen?.();
          break;
        case "m":
          video.muted = !video.muted;
          break;
        case ",":
          cycleRate(-1);
          break;
        case ".":
          cycleRate(1);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    <div className="relative group w-full h-full">
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
      <button
        type="button"
        onClick={() => {
          const idx = RATES.indexOf(rate);
          const next = RATES[(idx + 1) % RATES.length];
          requestPlaybackRate(next);
        }}
        className="absolute bottom-14 right-3 rounded bg-black/60 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {rate}x
      </button>
    </div>
  );
};