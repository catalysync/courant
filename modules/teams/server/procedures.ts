import { database } from "@/database";
import { teamMembers, teams, user } from "@/database/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";
import { createNotification } from "@/modules/notifications/server/procedures";

const roleRank: Record<string, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

// Assert the caller is a member of the team with at least the given role.
async function requireRole(teamId: string, userId: string, min: "viewer" | "editor" | "admin" | "owner") {
  const [m] = await database
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  if (!m) throw new TRPCError({ code: "FORBIDDEN", message: "Not a team member" });
  if (roleRank[m.role] < roleRank[min]) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
  return m;
}

const editableRoles = ["admin", "editor", "viewer"] as const;

export const teamsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(60) }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const [team] = await database
        .insert(teams)
        .values({ name: input.name, ownerId: userId })
        .returning();
      await database.insert(teamMembers).values({ teamId: team.id, userId, role: "owner" });
      return team;
    }),

  getMyTeams: protectedProcedure.query(async ({ ctx }) => {
    const { id: userId } = ctx.user;
    const memberCount = database.$count(teamMembers, eq(teamMembers.teamId, teams.id));
    return database
      .select({
        ...getTableColumns(teams),
        role: teamMembers.role,
        memberCount,
      })
      .from(teams)
      .innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, userId))
      .orderBy(desc(teams.createdAt), desc(teams.id));
  }),

  getMembers: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      await requireRole(input.teamId, userId, "viewer");
      return database
        .select({
          role: teamMembers.role,
          createdAt: teamMembers.createdAt,
          user,
        })
        .from(teamMembers)
        .innerJoin(user, eq(teamMembers.userId, user.id))
        .where(eq(teamMembers.teamId, input.teamId))
        .orderBy(desc(teamMembers.createdAt), desc(teamMembers.id));
    }),

  invite: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(editableRoles).default("editor"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      await requireRole(input.teamId, userId, "admin");

      const [target] = await database.select({ id: user.id }).from(user).where(eq(user.email, input.email));
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "No user with that email" });

      await database
        .insert(teamMembers)
        .values({ teamId: input.teamId, userId: target.id, role: input.role })
        .onConflictDoNothing();

      await createNotification({
        userId: target.id,
        actorId: userId,
        type: "team_invite",
        videoId: null,
        commentId: null,
      }).catch(() => {});

      return { ok: true };
    }),

  updateRole: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(editableRoles),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id: callerId } = ctx.user;
      await requireRole(input.teamId, callerId, "owner");
      if (input.userId === callerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't change your own role" });
      }
      const [target] = await database
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.userId, input.userId)));
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.role === "owner") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Can't change the owner's role" });
      }
      const [m] = await database
        .update(teamMembers)
        .set({ role: input.role })
        .where(and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.userId, input.userId)))
        .returning();
      return m;
    }),

  removeMember: protectedProcedure
    .input(z.object({ teamId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: callerId } = ctx.user;
      await requireRole(input.teamId, callerId, "admin");
      const [target] = await database
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.userId, input.userId)));
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.role === "owner") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Can't remove the owner" });
      }
      await database
        .delete(teamMembers)
        .where(and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.userId, input.userId)));
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: callerId } = ctx.user;
      await requireRole(input.teamId, callerId, "owner");
      await database.delete(teams).where(eq(teams.id, input.teamId));
      return { ok: true };
    }),
});
