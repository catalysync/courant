"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PictureInPicture2Icon,
  PlayIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { hlsUrl } from "@/lib/stream-urls";
import {
  formatTime,
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
const CONTROLS_HIDE_DELAY = 3000;

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

function ControlButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/60",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Cloudflare Stream player. Native HLS on Safari; hls.js everywhere else. Full control over
 * autoplay / play events (drives view counting). Ships its own overlay control bar instead of
 * the native browser controls.
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
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const hoveringRef = useRef(false);
  const scrubbingRef = useRef(false);

  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [canPip, setCanPip] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

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

  // Fullscreen + PiP capability / state.
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    setCanPip(
      typeof document !== "undefined" &&
        "pictureInPictureEnabled" in document &&
        document.pictureInPictureEnabled,
    );
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnterPip = () => setIsPip(true);
    const onLeavePip = () => setIsPip(false);
    video.addEventListener("enterpictureinpicture", onEnterPip);
    video.addEventListener("leavepictureinpicture", onLeavePip);
    return () => {
      video.removeEventListener("enterpictureinpicture", onEnterPip);
      video.removeEventListener("leavepictureinpicture", onLeavePip);
    };
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

  // Auto-hide the control bar after inactivity while playing.
  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      if (!hoveringRef.current && !videoRef.current?.paused) {
        setControlsVisible(false);
      }
    }, CONTROLS_HIDE_DELAY);
  }, [clearHideTimer]);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  const handleMouseEnter = () => {
    hoveringRef.current = true;
    setControlsVisible(true);
    scheduleHide();
  };

  const handleMouseMove = () => {
    hoveringRef.current = true;
    setControlsVisible(true);
    scheduleHide();
  };

  const handleMouseLeave = () => {
    hoveringRef.current = false;
    if (videoRef.current && !videoRef.current.paused) {
      setControlsVisible(false);
      clearHideTimer();
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const handleVolumeChange = (value: number) => {
    const video = videoRef.current;
    const next = Math.min(1, Math.max(0, value));
    setVolume(next);
    setMuted(next === 0);
    if (video) {
      video.volume = next;
      video.muted = next === 0;
    }
  };

  const handleSeekChange = (value: number) => {
    const video = videoRef.current;
    setCurrentTime(value);
    if (video) video.currentTime = value;
  };

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    requestPlaybackRate(next);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current?.requestFullscreen();
    }
  };

  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // PiP can fail (e.g. without a user gesture); ignore.
    }
  };

  if (!uid && !src) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black text-muted-foreground text-sm">
        Video is still processing…
      </div>
    );
  }

  const VolumeIcon = muted || volume === 0 ? VolumeXIcon : volume < 0.5 ? Volume1Icon : Volume2Icon;
  const sliderMax = Number.isFinite(duration) ? duration : 0;

  return (
    <div
      ref={containerRef}
      className="relative group w-full h-full"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        className={className ?? "w-full h-full object-contain"}
        poster={thumbnailUrl ?? undefined}
        autoPlay={autoPlay}
        playsInline
        preload={autoPlay ? "auto" : "metadata"}
        onPlay={() => {
          setIsPlaying(true);
          setPlaying(true);
          scheduleHide();
          onPlay?.();
        }}
        onPause={() => {
          setIsPlaying(false);
          setPlaying(false);
          setControlsVisible(true);
          clearHideTimer();
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setPlaybackTime(el.currentTime);
          if (!scrubbingRef.current) setCurrentTime(el.currentTime);
          onTimeUpdate?.(el.currentTime, el.duration || 0);
        }}
      />

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 bg-gradient-to-t from-black/80 to-transparent px-3 pt-8 pb-2.5 text-white transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={sliderMax}
          step={0.1}
          value={Math.min(currentTime, sliderMax)}
          onChange={(e) => handleSeekChange(Number(e.currentTarget.value))}
          onPointerDown={() => {
            scrubbingRef.current = true;
          }}
          onPointerUp={() => {
            scrubbingRef.current = false;
          }}
          onPointerCancel={() => {
            scrubbingRef.current = false;
          }}
          className="w-full h-1 cursor-pointer accent-primary"
        />

        <div className="flex items-center gap-1">
          <ControlButton label={playing ? "Pause" : "Play"} onClick={togglePlay}>
            {playing ? <PauseIcon className="size-5" /> : <PlayIcon className="size-5" />}
          </ControlButton>

          <ControlButton label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
            <VolumeIcon className="size-5" />
          </ControlButton>

          <input
            type="range"
            aria-label="Volume"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.currentTarget.value))}
            className="w-20 h-1 cursor-pointer accent-primary"
          />

          <span className="ml-1 text-xs font-medium tabular-nums text-white/90">
            {formatTime(currentTime)}
            <span className="mx-1 text-white/50">/</span>
            {formatTime(sliderMax)}
          </span>

          <div className="flex-1" />

          <button
            type="button"
            aria-label="Playback speed"
            title="Playback speed"
            onClick={cycleRate}
            className="inline-flex h-8 min-w-11 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums text-white transition-colors hover:bg-white/15"
          >
            {rate}x
          </button>

          {canPip ? (
            <ControlButton label={isPip ? "Exit picture-in-picture" : "Picture-in-picture"} onClick={togglePip}>
              <PictureInPicture2Icon className="size-5" />
            </ControlButton>
          ) : null}

          <ControlButton
            label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <MinimizeIcon className="size-5" /> : <MaximizeIcon className="size-5" />}
          </ControlButton>
        </div>
      </div>
    </div>
  );
};