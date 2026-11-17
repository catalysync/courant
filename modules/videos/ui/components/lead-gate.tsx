"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MailIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPause } from "@/lib/playback-time";
import { VideoGetOneOutput } from "../../types";

interface LeadGateProps {
  video: VideoGetOneOutput;
}

export const LeadGate = ({ video }: LeadGateProps) => {
  const { data: session, isPending: sessionLoading } = useSession();
  const [email, setEmail] = useState(session?.user?.email ?? "");
  const [name, setName] = useState(session?.user?.name ?? "");
  const [submitted, setSubmitted] = useState(false);

  const capture = trpc.leads.capture.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Thanks! You can now watch the video.");
    },
    onError: (e) => toast.error(e.message || "Something went wrong"),
  });

  const gated =
    video.requireEmail &&
    !sessionLoading &&
    session?.user?.id !== video.userId &&
    !submitted;

  useEffect(() => {
    if (gated) requestPause();
  }, [gated]);

  if (!gated) return null;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/85 p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) {
            toast.error("Email is required");
            return;
          }
          capture.mutate({
            videoId: video.id,
            email: email.trim(),
            name: name.trim() || null,
          });
        }}
        className="w-full max-w-sm rounded-xl border bg-card p-6 flex flex-col gap-4"
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <MailIcon className="size-8 text-primary" />
          <h3 className="text-base font-semibold">Enter your email to watch</h3>
          <p className="text-xs text-muted-foreground">
            This video requires your email to continue.
          </p>
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <Button type="submit" disabled={capture.isPending}>
          {capture.isPending ? "Unlocking…" : "Continue"}
        </Button>
      </form>
    </div>
  );
};