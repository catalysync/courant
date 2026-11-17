import { NextResponse } from "next/server";

// Lightweight health / keep-warm endpoint. Deliberately touches no D1/R2 so it
// is cheap to call. The `courant-keepwarm` Worker's cron pings this every
// minute to keep the main Worker's isolates warm (avoids cold-start latency on
// first visits).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json({ ok: true, t: Date.now() });
}
