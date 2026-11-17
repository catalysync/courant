"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { CaptionsIcon } from "lucide-react";

import { trpc } from "@/trpc/client";

interface TranscriptSectionProps {
  videoId: string;
}

export const TranscriptSection = ({ videoId }: TranscriptSectionProps) => {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <TranscriptSectionSuspense videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const TranscriptSectionSuspense = ({ videoId }: TranscriptSectionProps) => {
  const [transcript] = trpc.ai.getTranscript.useSuspenseQuery({ videoId });
  if (!transcript?.text) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-2">
        <CaptionsIcon className="size-4 text-muted-foreground" />
        <h2 className="text-base font-bold">Transcript</h2>
      </div>
      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground rounded-xl border p-4 leading-relaxed">
        {transcript.text}
      </div>
    </div>
  );
};