import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    // Legacy fields from Convex Auth (can be removed after migration)
    email: v.optional(v.string()),
  }),
  passkeys: defineTable({
    userId: v.id("users"),
    credentialId: v.string(), // base64url encoded
    publicKey: v.string(), // base64url encoded
    counter: v.number(),
    createdAt: v.number(),
  })
    .index("by_credential_id", ["credentialId"])
    .index("by_user", ["userId"]),
  sessions: defineTable({
    userId: v.id("users"),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    duration: v.optional(v.number()),
    notes: v.optional(v.string()),
    reflection: v.optional(v.string()),
    taskTitle: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "startTime"]),
});
