"use client";

// Lightweight cross-component playback bridge: the <VideoPlayer> reports its
// time + play state, the timecoded-comment UI reads/seeks, and the watch-party
// panel reads (host) or applies (viewer) synced playback state.

type TimeListener = (t: number) => void;
type PlayingListener = (p: boolean) => void;
type SeekListener = (t: number) => void;

let currentTime = 0;
let isPlaying = false;

const timeListeners = new Set<TimeListener>();
const playingListeners = new Set<PlayingListener>();
const seekListeners = new Set<SeekListener>();

export function setPlaybackTime(t: number) {
  currentTime = t;
  for (const l of timeListeners) l(t);
}

export function getPlaybackTime() {
  return currentTime;
}

export function subscribePlaybackTime(l: TimeListener) {
  timeListeners.add(l);
  return () => {
    timeListeners.delete(l);
  };
}

export function setIsPlaying(p: boolean) {
  isPlaying = p;
  for (const l of playingListeners) l(p);
}

export function getIsPlaying() {
  return isPlaying;
}

export function subscribeIsPlaying(l: PlayingListener) {
  playingListeners.add(l);
  return () => {
    playingListeners.delete(l);
  };
}

export function requestSeek(t: number) {
  currentTime = t;
  for (const l of seekListeners) l(t);
}

export function subscribeSeek(l: SeekListener) {
  seekListeners.add(l);
  return () => {
    seekListeners.delete(l);
  };
}

export function requestPlay() {
  isPlaying = true;
  for (const l of playingListeners) l(true);
}

export function requestPause() {
  isPlaying = false;
  for (const l of playingListeners) l(false);
}

/** Apply a remote (watch-party host) playback state to the local player. */
export function applyRemoteState(t: number, playing: boolean) {
  currentTime = t;
  isPlaying = playing;
  for (const l of seekListeners) l(t);
  for (const l of playingListeners) l(playing);
}

export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}