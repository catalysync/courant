"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2Icon,
  PauseIcon,
  PlayIcon,
  SendIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";

import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  applyRemoteState,
  formatTime,
  getIsPlaying,
  getPlaybackTime,
  requestPause,
  requestPlay,
  requestSeek,
  subscribeIsPlaying,
  subscribePlaybackTime,
} from "@/lib/playback-time";

interface WatchPartyProps {
  videoId: string;
  isOwner: boolean;
  duration?: number | null;
}

type Member = { id: string; name: string; isHost: boolean };
type ChatMsg = { userId: string; name: string; text: string; ts: number };

export const WatchParty = ({ videoId, isOwner, duration }: WatchPartyProps) => {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "anon";
  const name = session?.user?.name ?? "Viewer";

  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [position, setPosition] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const send = (data: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  };

  useEffect(() => {
    if (!open) return;
    const base = (process.env.NEXT_PUBLIC_SERVICES_URL ?? "").replace(/^http/, "ws");
    if (!base) return;
    const ws = new WebSocket(`${base}/watch/${videoId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "join", userId, name, isHost: isOwner }));
    };
    ws.onmessage = (e) => {
      let msg: any;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === "presence") {
        setMembers(msg.members ?? []);
      } else if (msg.type === "chat") {
        setMessages((m) => [...m, msg]);
      } else if (msg.type === "state") {
        if (!isOwner) applyRemoteState(msg.positionSec ?? 0, !!msg.isPlaying);
        setPosition(msg.positionSec ?? 0);
      }
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
  }, [open, videoId, userId, name, isOwner]);

  // Host: broadcast play/pause changes (covers both the panel buttons and the
  // player's native controls).
  useEffect(() => {
    if (!isOwner) return;
    return subscribeIsPlaying((playing) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: playing ? "play" : "pause",
            userId,
            positionSec: getPlaybackTime(),
          }),
        );
      }
    });
  }, [isOwner, userId]);

  // Track local position for the host's scrubber.
  useEffect(() => {
    return subscribePlaybackTime((t) => setPosition(t));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const togglePlay = () => {
    if (getIsPlaying()) requestPause();
    else requestPlay();
  };

  const onScrub = (t: number) => {
    requestSeek(t);
    if (isOwner) {
      send({ type: "seek", userId, positionSec: t, isPlaying: getIsPlaying() });
    }
  };

  const sendChat = () => {
    const value = text.trim();
    if (!value) return;
    send({ type: "chat", userId, text: value });
    setText("");
  };

  const maxDuration = duration && duration > 0 ? duration : 0;

  return (
    <div className="w-full">
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
        <UsersIcon className="size-4 mr-2" />
        Watch party
        {open && <XIcon className="size-4 ml-2" />}
      </Button>

      {open && (
        <div className="mt-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Watch party</h3>
              <span className="text-xs text-muted-foreground">
                {members.length} watching
              </span>
            </div>
            {!connected && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2Icon className="size-3 animate-spin" />
                connecting…
              </span>
            )}
          </div>

          {members.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {members.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {m.name}
                  {m.isHost && (
                    <span className="rounded-full bg-amber-500/20 text-amber-600 px-1.5 text-[10px] font-medium">
                      host
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}

          {isOwner && (
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/50 p-2.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={togglePlay}
              >
                {getIsPlaying() ? (
                  <PauseIcon className="size-4" />
                ) : (
                  <PlayIcon className="size-4" />
                )}
              </Button>
              <input
                type="range"
                min={0}
                max={maxDuration || 0}
                step={1}
                value={Math.min(position, maxDuration || 0)}
                disabled={!maxDuration}
                onChange={(e) => onScrub(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatTime(position)}
              </span>
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2 max-h-48 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Say hello — chat is live with everyone in this room.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-xs font-medium">
                  {m.name}
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {new Date(m.ts).toLocaleTimeString()}
                  </span>
                </span>
                <span className="text-sm">{m.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendChat();
            }}
          >
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Send a message…"
              className="h-9"
            />
            <Button type="submit" size="icon" variant="ghost" className="size-9">
              <SendIcon className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};