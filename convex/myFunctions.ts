import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Session management functions
export const createSession = mutation({
	args: {
		userId: v.id("users"),
		taskTitle: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId);
		if (!user) {
			throw new Error("User not found");
		}
		const startTime = Date.now();
		const sessionId = await ctx.db.insert("sessions", {
			userId: args.userId,
			startTime,
			taskTitle: args.taskTitle,
		});
		return sessionId;
	},
});

export const updateSession = mutation({
	args: {
		sessionId: v.id("sessions"),
		userId: v.id("users"),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (session === null || session.userId !== args.userId) {
			throw new Error("Session not found or unauthorized");
		}
		await ctx.db.patch(args.sessionId, {
			notes: args.notes,
		});
	},
});

export const completeSession = mutation({
	args: {
		sessionId: v.id("sessions"),
		userId: v.id("users"),
		reflection: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (session === null || session.userId !== args.userId) {
			throw new Error("Session not found or unauthorized");
		}
		const endTime = Date.now();
		const duration = endTime - session.startTime;
		await ctx.db.patch(args.sessionId, {
			endTime,
			duration,
			reflection: args.reflection,
		});
	},
});

export const getSessions = query({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const sessions = await ctx.db
			.query("sessions")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.collect();
		return sessions;
	},
});

export const getSessionsByDate = query({
	args: {
		userId: v.id("users"),
		date: v.number(), // timestamp for the start of the day
	},
	handler: async (ctx, args) => {
		const nextDay = args.date + 24 * 60 * 60 * 1000;
		const sessions = await ctx.db
			.query("sessions")
			.withIndex("by_user_and_date", (q) => q.eq("userId", args.userId))
			.filter((q) =>
				q.and(
					q.gte(q.field("startTime"), args.date),
					q.lt(q.field("startTime"), nextDay),
				),
			)
			.order("desc")
			.collect();
		return sessions;
	},
});

export const getSession = query({
	args: {
		sessionId: v.id("sessions"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (session === null || session.userId !== args.userId) {
			return null;
		}
		return session;
	},
});
