// courant-services
// Independent from the OpenNext worker. Handles:
//   - Real-time watch rooms (Durable Objects + WebSockets): presence, chat, synced playback.
//   - Async jobs (Cloudflare Queues): AI metadata refinement via Workers AI.
//
// WebSocket protocol (JSON):
//   client -> server: { type: "join", userId, name, isHost }
//                     { type: "chat", text }
//                     { type: "play", positionSec }   (host)
//                     { type: "pause", positionSec }  (host)
//                     { type: "seek", positionSec, isPlaying } (host)
//                     { type: "leave" }
//   server -> client: { type: "presence", members: [{id,name,isHost}] }
//                     { type: "chat", userId, name, text, ts }
//                     { type: "state", isPlaying, positionSec, speed }

interface Member {
  name: string;
  isHost: boolean;
}

interface RoomState {
  isPlaying: boolean;
  positionSec: number;
  speed: number;
  hostId: string | null;
}

export class WatchRoom {
  private room: Set<WebSocket>;
  private socketToUser: Map<WebSocket, string>;
  private members: Map<string, Member>;
  private state: RoomState;

  constructor() {
    this.room = new Set();
    this.socketToUser = new Map();
    this.members = new Map();
    this.state = { isPlaying: false, positionSec: 0, speed: 1, hostId: null };
  }

  private send(ws: WebSocket, data: unknown) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      /* socket may be closing */
    }
  }

  private broadcast(data: unknown, except?: WebSocket) {
    const msg = JSON.stringify(data);
    for (const ws of this.room) {
      if (ws !== except) {
        try {
          ws.send(msg);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private memberList() {
    return [...this.members.entries()].map(([id, m]) => ({ id, name: m.name, isHost: m.isHost }));
  }

  private canControl(userId: string): boolean {
    if (this.state.hostId === null) return true;
    return this.state.hostId === userId;
  }

  // Durable Object fetch entrypoint: handles the websocket upgrade and returns
  // the 101 response.
  fetch(_request: Request): Response {
    const [client, server] = Object.values(new WebSocketPair());
    this.room.add(server);
    // New member sees the current presence + playback state immediately.
    this.send(client, { type: "state", ...this.state });
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string) {
    let msg: any;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    switch (msg.type) {
      case "join": {
        const userId: string = msg.userId;
        this.socketToUser.set(ws, userId);
        this.members.set(userId, { name: String(msg.name ?? "Viewer").slice(0, 40), isHost: msg.isHost === true });
        if (msg.isHost) this.state.hostId = userId;
        this.broadcast({ type: "presence", members: this.memberList() });
        break;
      }
      case "chat": {
        const m = this.members.get(msg.userId);
        this.broadcast({
          type: "chat",
          userId: msg.userId,
          name: m?.name ?? "Viewer",
          text: String(msg.text ?? "").slice(0, 500),
          ts: Date.now(),
        });
        break;
      }
      case "play": {
        if (!this.canControl(msg.userId)) return;
        this.state.isPlaying = true;
        if (typeof msg.positionSec === "number") this.state.positionSec = msg.positionSec;
        this.broadcast({ type: "state", ...this.state });
        break;
      }
      case "pause": {
        if (!this.canControl(msg.userId)) return;
        this.state.isPlaying = false;
        if (typeof msg.positionSec === "number") this.state.positionSec = msg.positionSec;
        this.broadcast({ type: "state", ...this.state });
        break;
      }
      case "seek": {
        if (!this.canControl(msg.userId)) return;
        this.state.positionSec = Number(msg.positionSec) || 0;
        if (typeof msg.isPlaying === "boolean") this.state.isPlaying = msg.isPlaying;
        this.broadcast({ type: "state", ...this.state });
        break;
      }
      case "leave": {
        this.handleLeave(msg.userId);
        break;
      }
    }
  }

  webSocketClose(ws: WebSocket) {
    this.room.delete(ws);
    const userId = this.socketToUser.get(ws);
    this.socketToUser.delete(ws);
    if (userId) this.handleLeave(userId);
  }

  private handleLeave(userId: string) {
    if (!this.members.delete(userId)) return;
    if (this.state.hostId === userId) {
      const next = [...this.members.keys()][0] ?? null;
      this.state.hostId = next;
      if (next) {
        const m = this.members.get(next);
        if (m) m.isHost = true;
      }
    }
    this.broadcast({ type: "presence", members: this.memberList() });
  }
}

interface Env {
  DB: D1Database;
  AI: any;
  WATCH_ROOM: DurableObjectNamespace;
  JOBS: any;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/watch/") && request.headers.get("Upgrade") === "websocket") {
      const roomId = url.pathname.slice("/watch/".length);
      if (!roomId) return new Response("Missing room id", { status: 400 });
      const name = roomId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40) || "default";
      const id = env.WATCH_ROOM.idFromName(name);
      const room = env.WATCH_ROOM.get(id);
      return room.fetch(request);
    }
    // Health / keep-warm (also keeps this worker's isolates warm).
    return Response.json({ ok: true, service: "courant-services" });
  },

  async queue(batch: MessageBatch<{ videoId: string; type?: string }>, env: Env) {
    for (const message of batch.messages) {
      try {
        await this.refineMetadata(message.body.videoId, env);
      } catch (e) {
        console.error("refine_metadata failed", e);
      }
    }
  },

  async refineMetadata(videoId: string, env: Env) {
    if (!videoId) return;
    const video: any = await env.DB.prepare("SELECT * FROM videos WHERE id = ?").bind(videoId).first();
    if (!video) return;
    const hasTitle = video.title && video.title !== "Untitled video";
    const hasDescription = !!video.description;
    if (hasTitle && hasDescription) return; // nothing to refine

    const prompt =
      `You are a video platform. Write a catchy, specific title (max 60 chars) and a 1-2 sentence description ` +
      `(max 200 chars) for a video. Context: title="${video.title ?? "Untitled"}", description="${
        video.description ?? ""
      }". Reply as JSON: {"title": "...", "description": "..."}`;

    const completion = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    });

    let parsed: any = null;
    try {
      const text = (completion?.content?.[0]?.text ?? "").replace(/```json|```/g, "").trim();
      parsed = JSON.parse(text);
    } catch {
      /* model didn't return valid JSON; skip */
    }
    if (!parsed) return;

    const patch: Record<string, unknown> = {};
    if (!hasTitle && parsed.title) patch.title = String(parsed.title).slice(0, 100);
    if (!hasDescription && parsed.description) patch.description = String(parsed.description).slice(0, 500);
    if (Object.keys(patch).length) {
      await env.DB.prepare(
        "UPDATE videos SET title = COALESCE(?, title), description = COALESCE(?, description), updated_at = ? WHERE id = ?",
      )
        .bind(patch.title ?? null, patch.description ?? null, Math.floor(Date.now()), videoId)
        .run();
    }
  },
};
