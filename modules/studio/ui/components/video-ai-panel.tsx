"use client";

import { Suspense, useState } from "react";
import { toast } from "sonner";
import { FileTextIcon, ListVideoIcon, SparklesIcon } from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface VideoAIPanelProps {
  videoId: string;
}

export const VideoAIPanel = ({ videoId }: VideoAIPanelProps) => {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ErrorBoundary fallback={<div className="py-8 text-center text-sm text-muted-foreground">Something went wrong</div>}>
        <VideoAIPanelSuspense videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const VideoAIPanelSuspense = ({ videoId }: VideoAIPanelProps) => {
  const utils = trpc.useUtils();

  const [chapters] = trpc.ai.getChapters.useSuspenseQuery({ videoId });
  const [transcript] = trpc.ai.getTranscript.useSuspenseQuery({ videoId });

  const [text, setText] = useState(transcript?.text ?? "");

  const generateChapters = trpc.ai.generateChapters.useMutation({
    onSuccess: () => {
      utils.ai.getChapters.invalidate({ videoId });
      toast.success("Chapters generated");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const saveTranscript = trpc.ai.saveTranscript.useMutation({
    onSuccess: () => {
      utils.ai.getTranscript.invalidate({ videoId });
      toast.success("Transcript saved");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const refreshEmbedding = trpc.ai.refreshEmbedding.useMutation({
    onSuccess: () => toast.success("Indexed for search"),
    onError: () => toast.error("Something went wrong"),
  });

  return (
    <div className="space-y-6">
      <ChaptersSection
        chapters={chapters}
        generating={generateChapters.isPending}
        onGenerate={() => generateChapters.mutate({ videoId })}
      />
      <Separator />
      <TranscriptSection
        text={text}
        setText={setText}
        saving={saveTranscript.isPending}
        onSave={() => saveTranscript.mutate({ videoId, text })}
      />
      <Separator />
      <SearchSection
        indexing={refreshEmbedding.isPending}
        onIndex={() => refreshEmbedding.mutate({ videoId })}
      />
    </div>
  );
};

interface Chapter {
  id: string;
  title: string;
  startSec: number;
  endSec: number | null;
  order: number;
}

interface ChaptersSectionProps {
  chapters: Chapter[];
  generating: boolean;
  onGenerate: () => void;
}

const ChaptersSection = ({
  chapters,
  generating,
  onGenerate,
}: ChaptersSectionProps) => {
  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListVideoIcon className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Chapters</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={generating}
          onClick={onGenerate}
        >
          {generating ? "Generating…" : "Generate chapters"}
        </Button>
      </div>

      {chapters.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No chapters yet. Generate chapters from your video&apos;s transcript.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {chapters.map((chapter) => (
            <div
              key={chapter.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <p className="text-sm font-medium">{chapter.title}</p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatTime(chapter.startSec)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface TranscriptSectionProps {
  text: string;
  setText: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}

const TranscriptSection = ({
  text,
  setText,
  saving,
  onSave,
}: TranscriptSectionProps) => {
  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex items-center gap-2">
        <FileTextIcon className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Transcript</h2>
      </div>

      <Textarea
        rows={6}
        placeholder="Paste or edit the transcript…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="resize-none"
      />

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Chapters and search use this transcript.
        </p>
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save transcript"}
        </Button>
      </div>
    </div>
  );
};

interface SearchSectionProps {
  indexing: boolean;
  onIndex: () => void;
}

const SearchSection = ({ indexing, onIndex }: SearchSectionProps) => {
  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex items-center gap-2">
        <SparklesIcon className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Search indexing</h2>
      </div>

      <p className="text-xs text-muted-foreground">
        Indexes your video&apos;s title and description so viewers can find it
        with semantic search.
      </p>

      <Button type="button" variant="outline" onClick={onIndex} disabled={indexing}>
        {indexing ? "Indexing…" : "Index for semantic search"}
      </Button>
    </div>
  );
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}