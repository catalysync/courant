"use client";

import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { CaptionsIcon, LanguagesIcon } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/trpc/client";
import { useSession } from "@/lib/auth-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LANGUAGES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  hi: "Hindi",
  ar: "Arabic",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
};

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
  const [available] = trpc.ai.getTranscripts.useSuspenseQuery({ videoId });
  const [language, setLanguage] = useState("en");
  const { data: session } = useSession();
  const utils = trpc.useUtils();

  const { data: transcript } = trpc.ai.getTranscript.useQuery({ videoId, language });

  const translate = trpc.ai.translateTranscript.useMutation({
    onSuccess: (t) => {
      utils.ai.getTranscripts.invalidate({ videoId });
      if (t?.language) setLanguage(t.language);
      toast.success("Translation added");
    },
    onError: (e) => toast.error(e.message || "Translation failed"),
  });

  if (!available.length) return null;

  const langs = available.map((a) => a.language);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <CaptionsIcon className="size-4 text-muted-foreground" />
          <h2 className="text-base font-bold">Transcript</h2>
        </div>
        <div className="flex items-center gap-2">
          {langs.length > 1 && (
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {langs.map((l) => (
                  <SelectItem key={l} value={l}>
                    {LANGUAGES[l] ?? l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {session?.user && (
            <Select
              value=""
              onValueChange={(l) => translate.mutate({ videoId, targetLanguage: l })}
            >
              <SelectTrigger className="h-8 w-36">
                <LanguagesIcon className="size-4 mr-2" />
                <SelectValue placeholder="Translate" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANGUAGES)
                  .filter(([code]) => code !== "en" && !langs.includes(code))
                  .map(([code, label]) => (
                    <SelectItem key={code} value={code}>
                      {label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground rounded-xl border p-4 leading-relaxed">
        {transcript?.text ?? "No transcript for this language yet."}
      </div>
    </div>
  );
};