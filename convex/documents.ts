import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const createDocument = mutation({
  args: {
    title: v.string(),
    type: v.union(v.literal("code"), v.literal("note")),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    return await ctx.db.insert("documents", {
      title: args.title,
      content: "",
      type: args.type,
      language: args.language,
      createdBy: userId,
      lastModifiedBy: userId,
      lastModifiedAt: now,
    });
  },
});

export const getDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    return document;
  },
});

export const listDocuments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("documents")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .order("desc")
      .collect();
  },
});

export const updateDocument = mutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(),
    cursorPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    const now = Date.now();

    // Update the document
    await ctx.db.patch(args.documentId, {
      content: args.content,
      lastModifiedBy: userId,
      lastModifiedAt: now,
    });

    // Record the edit
    await ctx.db.insert("documentEdits", {
      documentId: args.documentId,
      userId,
      content: args.content,
      cursorPosition: args.cursorPosition,
      timestamp: now,
    });

    return { success: true };
  },
});

export const updateUserPresence = mutation({
  args: {
    documentId: v.id("documents"),
    cursorPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();

    // Check if user already has presence for this document
    const existingPresence = await ctx.db
      .query("activeUsers")
      .withIndex("by_user_and_document", (q) => 
        q.eq("userId", userId).eq("documentId", args.documentId)
      )
      .unique();

    if (existingPresence) {
      await ctx.db.patch(existingPresence._id, {
        cursorPosition: args.cursorPosition,
        lastSeen: now,
      });
    } else {
      await ctx.db.insert("activeUsers", {
        documentId: args.documentId,
        userId,
        userName: user.name || user.email || "Anonymous",
        cursorPosition: args.cursorPosition,
        lastSeen: now,
      });
    }

    return { success: true };
  },
});

export const getActiveUsers = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000; // 5 minutes

    const activeUsers = await ctx.db
      .query("activeUsers")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.gt(q.field("lastSeen"), fiveMinutesAgo))
      .collect();

    // Filter out current user
    return activeUsers.filter(user => user.userId !== userId);
  },
});

export const deleteDocument = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    if (document.createdBy !== userId) {
      throw new Error("Not authorized to delete this document");
    }

    // Delete related data
    const edits = await ctx.db
      .query("documentEdits")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const edit of edits) {
      await ctx.db.delete(edit._id);
    }

    const activeUsers = await ctx.db
      .query("activeUsers")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const user of activeUsers) {
      await ctx.db.delete(user._id);
    }

    // Delete the document
    await ctx.db.delete(args.documentId);

    return { success: true };
  },
});
