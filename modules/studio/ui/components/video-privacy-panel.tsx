"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  EyeOffIcon,
  HistoryIcon,
  KeyRoundIcon,
  RefreshCcwIcon,
  ShieldCheckIcon,
  UploadCloudIcon,
} from "lucide-react";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StudioUploader } from "./studio-sidebar/studio-uploader";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

interface VideoPrivacyPanelProps {
  videoId: string;
}

export const VideoPrivacyPanel = ({ videoId }: VideoPrivacyPanelProps) => {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ErrorBoundary fallback={<div className="py-8 text-center text-sm text-muted-foreground">Something went wrong</div>}>
        <VideoPrivacyPanelSuspense videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const VideoPrivacyPanelSuspense = ({ videoId }: VideoPrivacyPanelProps) => {
  const utils = trpc.useUtils();
  const [video] = trpc.studio.getOne.useSuspenseQuery({ id: videoId });

  const existingDomains: string[] = video.allowedDomains
    ? safeParseDomains(video.allowedDomains)
    : [];

  const [isUnlisted, setIsUnlisted] = useState(!!video.isUnlisted);
  const [password, setPassword] = useState("");
  const [domains, setDomains] = useState(existingDomains.join("\n"));

  const updatePrivacy = trpc.videos.updatePrivacy.useMutation({
    onSuccess: () => {
      utils.studio.getOne.invalidate({ id: videoId });
      toast.success("Privacy settings saved");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const onSave = () => {
    updatePrivacy.mutate({
      videoId,
      isUnlisted,
      password: password.trim() ? password.trim() : null,
      clearPassword: password.trim() ? false : null,
      allowedDomains: domains
        .split("\n")
        .map((d) => d.trim())
        .filter(Boolean),
    });
    setPassword("");
  };

  return (
    <div className="space-y-6">
      <PrivacyFields
        isUnlisted={isUnlisted}
        setIsUnlisted={setIsUnlisted}
        password={password}
        setPassword={setPassword}
        domains={domains}
        setDomains={setDomains}
        saving={updatePrivacy.isPending}
        onSave={onSave}
        hasPassword={!!video.passwordHash || existingDomains.length > 0}
      />
      <Separator />
      <VersionsPanel videoId={videoId} />
    </div>
  );
};

interface PrivacyFieldsProps {
  isUnlisted: boolean;
  setIsUnlisted: (v: boolean) => void;
  password: string;
  setPassword: (v: string) => void;
  domains: string;
  setDomains: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  hasPassword: boolean;
}

const PrivacyFields = ({
  isUnlisted,
  setIsUnlisted,
  password,
  setPassword,
  domains,
  setDomains,
  saving,
  onSave,
  hasPassword,
}: PrivacyFieldsProps) => {
  return (
    <div className="flex flex-col gap-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Privacy &amp; access</h2>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <EyeOffIcon className="size-4 text-muted-foreground" />
          <Label htmlFor="unlisted">Unlisted</Label>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Switch
            id="unlisted"
            checked={isUnlisted}
            onCheckedChange={setIsUnlisted}
          />
          <p className="text-xs text-muted-foreground">
            Only people with the link can watch
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <KeyRoundIcon className="size-4 text-muted-foreground" />
          <Label htmlFor="password">Password</Label>
          {hasPassword && (
            <span className="text-xs text-muted-foreground">(currently set)</span>
          )}
        </div>
        <Input
          id="password"
          type="password"
          placeholder="Set a password (leave blank to keep current)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="domains">
          Allowed email domains <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="domains"
          rows={3}
          placeholder={"example.com\nmycompany.org"}
          value={domains}
          onChange={(e) => setDomains(e.target.value)}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          One domain per line. Viewers signed in with a matching email domain can
          watch without a password.
        </p>
      </div>

      <Button type="button" onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : "Save privacy settings"}
      </Button>
    </div>
  );
};

interface VersionsPanelProps {
  videoId: string;
}

const VersionsPanel = ({ videoId }: VersionsPanelProps) => {
  const utils = trpc.useUtils();
  const [versions] = trpc.videos.getVersions.useSuspenseQuery({ videoId });

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [note, setNote] = useState("");
  const [uploadURL, setUploadURL] = useState<string | null>(null);

  const restore = trpc.videos.restoreVersion.useMutation({
    onSuccess: () => {
      utils.videos.getVersions.invalidate({ videoId });
      utils.studio.getOne.invalidate({ id: videoId });
      toast.success("Version restored");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const replace = trpc.videos.replaceVideo.useMutation({
    onSuccess: (data) => {
      setUploadURL(data.uploadURL);
      utils.videos.getVersions.invalidate({ videoId });
    },
    onError: () => toast.error("Something went wrong"),
  });

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Versions</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setNote("");
            setUploadURL(null);
            setReplaceOpen(true);
          }}
        >
          <UploadCloudIcon className="size-4 mr-2" />
          Replace video
        </Button>
      </div>

      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No previous versions yet. Replacements will be recorded here.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {versions.map((version) => (
            <div
              key={version.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">Version {version.version}</p>
                <p className="text-xs text-muted-foreground">
                  {version.note ?? "No note"} ·{" "}
                  {new Date(version.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={restore.isPending}
                onClick={() => restore.mutate({ videoId, versionId: version.id })}
              >
                <RefreshCcwIcon className="size-4 mr-2" />
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace video</DialogTitle>
            <DialogDescription>
              {uploadURL
                ? "Upload the new video file. The current version is saved automatically."
                : "Replacing keeps the same link and comments. The current video is saved as a version."}
            </DialogDescription>
          </DialogHeader>

          {uploadURL ? (
            <StudioUploader
              endpoint={uploadURL}
              onSuccess={() => {
                utils.studio.getOne.invalidate({ id: videoId });
                utils.videos.getVersions.invalidate({ videoId });
                toast.success("Replacement uploaded — processing…");
                setReplaceOpen(false);
                setUploadURL(null);
              }}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <Label htmlFor="replace-note">Note (optional)</Label>
              <Input
                id="replace-note"
                placeholder="What changed in this version?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <DialogFooter>
                <Button
                  type="button"
                  disabled={replace.isPending}
                  onClick={() => replace.mutate({ videoId, note: note || null })}
                >
                  {replace.isPending ? "Preparing…" : "Continue"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function safeParseDomains(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((d) => typeof d === "string") : [];
  } catch {
    return [];
  }
}