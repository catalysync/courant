"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import Link from "next/link";
import { RadioIcon, SendIcon, UsersIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { useSession } from "@/lib/auth-client";
import { VideoPlayer } from "@/modules/videos/ui/components/video-player";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface LiveViewProps {
  liveId: string;
}

export const LiveView = ({ liveId }: LiveViewProps) => {
  return (
    <Suspense fallback={<Skeleton className="aspect-video" />}>
      <ErrorBoundary fallback={<p className="p-6 text-muted-foreground">Stream unavailable</p>}>
        <LiveViewSuspense liveId={liveId} />
      </ErrorBoundary>
    </Suspense>
  );
};

type ChatMsg = { userId: string; name: string; text: string; ts: number };
type Member = { id: string; name: string; isHost: boolean };

const LiveViewSuspense = ({ liveId }: LiveViewProps) => {
  const [live] = trpc.live.getLive.useSuspenseQuery({ id: liveId });

  if (!live) return <p className="p-6 text-muted-foreground">Stream not found</p>;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="aspect-video bg-black rounded-xl overflow-hidden">
          {live.playbackUrl ? (
            <VideoPlayer src={live.playbackUrl} autoPlay />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/60 text-sm">
              Waiting for the stream to start…
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-400 px-2 py-0.5 text-xs font-medium">
              <RadioIcon className="size-3" />
              LIVE
            </span>
            <h1 className="text-xl font-bold">{live.title}</h1>
          </div>
          <Link
            href={`/users/${live.creator.id}`}
            className="mt-2 flex items-center gap-2 text-sm hover:underline"
          >
            <UserAvatar size="sm" imageUrl={live.creator.image} name={live.creator.name} />
            {live.creator.name}
          </Link>
        </div>
      </div>
      <LiveChat roomId={liveId} />
    </div>
  );
};

const LiveChat = ({ roomId }: { roomId: string }) => {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "anon";
  const name = session?.user?.name ?? "Viewer";

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [text, setText] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const base = (process.env.NEXT_PUBLIC_SERVICES_URL ?? "").replace(/^http/, "ws");
    if (!base) return;
    const ws = new WebSocket(`${base}/watch/${roomId}`);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "join", userId, name, isHost: false }));
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "chat") setMessages((m) => [...m, msg]);
        else if (msg.type === "presence") setMembers(msg.members ?? []);
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [roomId, userId, name]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const value = text.trim();
    if (!value || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "chat", userId, text: value }));
    setText("");
  };

  return (
    <div className="flex flex-col rounded-xl border bg-card h-[560px]">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <UsersIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Live chat</span>
        <span className="text-xs text-muted-foreground">{members.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">Say hello 👋</p>
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
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Send a message…"
          className="h-9"
        />
        <Button type="submit" size="icon" className="size-9" aria-label="Send message">
          <SendIcon className="size-4" />
        </Button>
      </form>
    </div>
  );
};