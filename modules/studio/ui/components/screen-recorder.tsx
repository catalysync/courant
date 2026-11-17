"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CameraIcon, Loader2Icon, MonitorIcon, SquareIcon, VideoIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** In-browser screen/camera recorder (Wistia "Soapbox"), uploaded straight to Stream. */
export const ScreenRecorder = () => {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"screen" | "camera">("screen");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createVideo = trpc.videos.create.useMutation();

  const start = async () => {
    try {
      const stream =
        mode === "screen"
          ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
          : await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      setBlob(null);

      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const parts = chunksRef.current;
        setBlob(new Blob(parts, { type: mime }));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(1000);
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Could not start recording (permission denied?)");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const upload = async () => {
    if (!blob) return;
    setUploading(true);
    try {
      const { url } = await createVideo.mutateAsync();
      const tus = await import("tus-js-client");
      const file = new File([blob], "recording.webm", { type: blob.type });
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: url,
          retryDelays: [0, 1000, 3000],
          chunkSize: 5 * 1024 * 1024,
          metadata: { filename: "recording.webm", filetype: blob.type },
          onSuccess: () => resolve(),
          onError: (e) => reject(e),
        });
        upload.start();
      });
      toast.success("Recording uploaded — processing…");
      utils.studio.getMany.invalidate();
      setOpen(false);
      setBlob(null);
      router.push("/studio");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <CameraIcon className="size-4 mr-2" />
          Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record your screen or camera</DialogTitle>
          <DialogDescription>
            Record in-browser and publish straight to your channel.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!recording && !blob && (
            <div className="flex gap-2">
              <Button
                variant={mode === "screen" ? "default" : "outline"}
                onClick={() => setMode("screen")}
              >
                <MonitorIcon className="size-4 mr-2" />
                Screen
              </Button>
              <Button
                variant={mode === "camera" ? "default" : "outline"}
                onClick={() => setMode("camera")}
              >
                <VideoIcon className="size-4 mr-2" />
                Camera
              </Button>
            </div>
          )}

          {recording && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="flex items-center gap-2 text-sm">
                <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                Recording {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
              </span>
              <Button variant="destructive" size="sm" onClick={stop}>
                <SquareIcon className="size-4 mr-2" />
                Stop
              </Button>
            </div>
          )}

          {blob && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Recording ready ({Math.round(blob.size / 1024)} KB)
              </p>
              <Button onClick={upload} disabled={uploading}>
                {uploading ? <Loader2Icon className="size-4 mr-2 animate-spin" /> : null}
                Upload to channel
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setBlob(null)}>
                Discard
              </Button>
            </div>
          )}

          {!recording && !blob && (
            <Button onClick={start} disabled={recording}>
              Start recording
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};