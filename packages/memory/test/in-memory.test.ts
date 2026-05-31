import { describe, it, expect } from "vitest";
import { InMemoryStore } from "../src/in-memory.js";

describe("InMemoryStore", () => {
  it("adds and retrieves messages", async () => {
    const store = new InMemoryStore();
    await store.add("conv-1", { role: "user", content: "Hello" });
    const messages = await store.get("conv-1");
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Hello");
    expect(messages[0].timestamp).toBeDefined();
  });

  it("limits messages by maxMessages", async () => {
    const store = new InMemoryStore({ maxMessages: 3 });
    await store.add("conv-1", { role: "user", content: "1" });
    await store.add("conv-1", { role: "user", content: "2" });
    await store.add("conv-1", { role: "user", content: "3" });
    await store.add("conv-1", { role: "user", content: "4" });
    const messages = await store.get("conv-1");
    expect(messages).toHaveLength(3);
    // Oldest non-system message should be trimmed
    expect(messages.map((m) => m.content)).toEqual(["2", "3", "4"]);
  });

  it("preserves system messages when trimming", async () => {
    const store = new InMemoryStore({ maxMessages: 3 });
    await store.add("conv-1", { role: "system", content: "Sys" });
    await store.add("conv-1", { role: "user", content: "1" });
    await store.add("conv-1", { role: "user", content: "2" });
    await store.add("conv-1", { role: "user", content: "3" });
    const messages = await store.get("conv-1");
    expect(messages.map((m) => m.content)).toEqual(["Sys", "2", "3"]);
  });

  it("gets with limit", async () => {
    const store = new InMemoryStore();
    await store.add("conv-1", { role: "system", content: "Sys" });
    await store.add("conv-1", { role: "user", content: "1" });
    await store.add("conv-1", { role: "user", content: "2" });
    const messages = await store.get("conv-1", 1);
    expect(messages.map((m) => m.content)).toEqual(["Sys", "2"]);
  });

  it("getWithTokenLimit respects budget", async () => {
    const store = new InMemoryStore({ charsPerToken: 1 });
    await store.add("conv-1", { role: "system", content: "SYS" }); // 3 tokens
    await store.add("conv-1", { role: "user", content: "AAAA" }); // 4 tokens
    await store.add("conv-1", { role: "user", content: "BBBBB" }); // 5 tokens
    const messages = await store.getWithTokenLimit("conv-1", 8);
    // SYS (3) + BBBBB (5) = 8 <= 8, AAAA (4) would exceed remaining 0
    expect(messages.map((m) => m.content)).toEqual(["SYS", "BBBBB"]);
  });

  it("clears conversation", async () => {
    const store = new InMemoryStore();
    await store.add("conv-1", { role: "user", content: "Hello" });
    await store.clear("conv-1");
    const messages = await store.get("conv-1");
    expect(messages).toHaveLength(0);
  });

  it("deletes conversation", async () => {
    const store = new InMemoryStore();
    await store.add("conv-1", { role: "user", content: "Hello" });
    await store.delete("conv-1");
    expect(await store.has("conv-1")).toBe(false);
  });

  it("lists conversations", async () => {
    const store = new InMemoryStore();
    await store.add("a", { role: "user", content: "A" });
    await store.add("b", { role: "user", content: "B" });
    const convs = await store.listConversations();
    expect(convs).toContain("a");
    expect(convs).toContain("b");
  });

  it("returns conversation info", async () => {
    const store = new InMemoryStore();
    await store.add("conv-1", { role: "user", content: "Hello" });
    const info = await store.getConversationInfo("conv-1");
    expect(info).not.toBeNull();
    expect(info!.messageCount).toBe(1);
    expect(info!.id).toBe("conv-1");
  });
});
