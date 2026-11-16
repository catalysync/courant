import { database } from "@/database";
import { videos } from "@/database/schema";
import { verifyStreamWebhook, previewUrl, thumbnailUrl } from "@/lib/stream";
import { eq } from "drizzle-orm";

const STREAM_WEBHOOK_SECRET = process.env.STREAM_WEBHOOK_SECRET;

type StreamWebhookEvent = {
  uid: string;
  status?: { state: string; errorReasonCode?: string; errorReasonText?: string };
  duration?: number;
  thumbnail?: string;
  preview?: string;
};

export const POST = async (req: Request) => {
  if (!STREAM_WEBHOOK_SECRET) {
    return new Response("STREAM_WEBHOOK_SECRET is not set", { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("webhook-signature");

  if (!verifyStreamWebhook(rawBody, signature, STREAM_WEBHOOK_SECRET)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: StreamWebhookEvent;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { uid, status, duration } = payload;

  switch (status?.state) {
    case "ready": {
      await database
        .update(videos)
        .set({
          streamStatus: "ready",
          duration: duration ? Math.round(duration * 1000) : 0,
          thumbnailUrl: thumbnailUrl(uid),
          previewUrl: previewUrl(uid),
        })
        .where(eq(videos.streamUid, uid));
      break;
    }
    case "error": {
      await database
        .update(videos)
        .set({ streamStatus: "error" })
        .where(eq(videos.streamUid, uid));
      break;
    }
    default: {
      await database
        .update(videos)
        .set({ streamStatus: status?.state ?? "pendingupload" })
        .where(eq(videos.streamUid, uid));
      break;
    }
  }

  return new Response(null, { status: 200 });
};