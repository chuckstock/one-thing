import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

// Get current user ID from userId stored client-side
export const getCurrentUser = query({
	args: {
		userId: v.optional(v.id("users")),
	},
	handler: async (ctx, args) => {
		if (!args.userId) {
			return null;
		}
		const user = await ctx.db.get(args.userId);
		return user;
	},
});

// Helper to get user ID from context (for mutations/queries that receive userId)
export async function getUserId(
	ctx: {
		db: { get: (id: Id<"users">) => Promise<{ _id: Id<"users"> } | null> };
	},
	userId: Id<"users"> | null,
): Promise<Id<"users"> | null> {
	if (!userId) {
		return null;
	}
	const user = await ctx.db.get(userId);
	return user?._id ?? null;
}

// Register a new passkey and create user
export const registerPasskey = mutation({
	args: {
		credentialId: v.string(), // base64url encoded
		publicKey: v.string(), // base64url encoded (COSE format)
		counter: v.number(),
	},
	handler: async (ctx, args) => {
		// Check if credential already exists
		const existingPasskey = await ctx.db
			.query("passkeys")
			.withIndex("by_credential_id", (q) =>
				q.eq("credentialId", args.credentialId),
			)
			.first();

		if (existingPasskey) {
			throw new Error("Passkey already registered");
		}

		// Create new user
		const userId = await ctx.db.insert("users", {
			createdAt: Date.now(),
		});

		// Store passkey credential
		await ctx.db.insert("passkeys", {
			userId,
			credentialId: args.credentialId,
			publicKey: args.publicKey,
			counter: args.counter,
			createdAt: Date.now(),
		});

		return { userId };
	},
});

// Authenticate with passkey
export const authenticatePasskey = mutation({
	args: {
		credentialId: v.string(),
		counter: v.number(),
	},
	handler: async (ctx, args) => {
		const passkey = await ctx.db
			.query("passkeys")
			.withIndex("by_credential_id", (q) =>
				q.eq("credentialId", args.credentialId),
			)
			.first();

		if (!passkey) {
			throw new Error("Passkey not found");
		}

		// Verify counter
		// Some authenticators (e.g., Apple iCloud Keychain) don't support counters and always return 0
		// Allow counter >= stored counter (equal is OK for non-counter authenticators)
		// Reject only if counter < stored counter (indicates potential cloned credential)
		if (args.counter < passkey.counter) {
			throw new Error("Invalid counter: counter decreased, possible cloned credential");
		}

		// Update counter only if it increased (for authenticators that support counters)
		if (args.counter > passkey.counter) {
			await ctx.db.patch(passkey._id, {
				counter: args.counter,
			});
		}

		return { userId: passkey.userId };
	},
});

// Get passkey challenge for authentication
export const getPasskeyChallenge = query({
	args: {},
	handler: async () => {
		// Generate a random challenge
		const array = new Uint8Array(32);
		crypto.getRandomValues(array);
		// Convert to base64url manually
		const base64 = btoa(String.fromCharCode(...array));
		const base64url = base64
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=/g, "");
		return {
			challenge: base64url,
		};
	},
});
