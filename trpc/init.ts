import { auth } from "@/lib/auth";
import { initTRPC, TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { cache } from "react";
import superjson from "superjson";

/**
 * tRPC context now carries the Better Auth session. The authenticated user IS the D1 `user`
 * row (Better Auth's canonical table), so there is no clerkId lookup anymore.
 */

export const createTRPCContext = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return { session };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async function isAuthed(opts) {
  const { ctx } = opts;

  const currentUser = ctx.session?.user;
  if (!currentUser) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return opts.next({
    ctx: {
      ...ctx,
      user: currentUser,
    },
  });
});

export const adminProcedure = protectedProcedure.use(async (opts) => {
  if (opts.ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return opts.next();
});