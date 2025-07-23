import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  documents: defineTable({
    title: v.string(),
    content: v.string(),
    type: v.union(v.literal("code"), v.literal("note")),
    language: v.optional(v.string()), // for code documents
    createdBy: v.id("users"),
    lastModifiedBy: v.id("users"),
    lastModifiedAt: v.number(),
  }).index("by_created_by", ["createdBy"]),

  documentEdits: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    content: v.string(),
    cursorPosition: v.number(),
    timestamp: v.number(),
  }).index("by_document", ["documentId"])
    .index("by_document_and_timestamp", ["documentId", "timestamp"]),

  activeUsers: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    userName: v.string(),
    cursorPosition: v.number(),
    lastSeen: v.number(),
  }).index("by_document", ["documentId"])
    .index("by_user_and_document", ["userId", "documentId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
