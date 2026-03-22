import { describe, expect, it, vi } from "vitest";
import type { AgentConfig, AgentContext, LLMMessage, LLMResponse } from "../src/index.js";
import {
  BaseAgent,
  InMemoryStore,
  RuleEngine,
  TaskQueue,
  blockToolsRule,
  defineTool,
  generateId,
  requireAuthRule,
} from "../src/index.js";

// ─── Test agent implementation ────────────────────────────────────────────────

class MockAgent extends BaseAgent {
  private mockResponse: string;

  constructor(config: AgentConfig, mockResponse = "mock response") {
    super(config);
    this.mockResponse = mockResponse;
  }

  protected async callLLM(_messages: LLMMessage[], _context: AgentContext): Promise<LLMResponse> {
    return {
      content: this.mockResponse,
      finishReason: "stop",
    };
  }
}

// ─── generateId ───────────────────────────────────────────────────────────────

describe("generateId", () => {
  it("generates unique ids with prefix", () => {
    const a = generateId("test");
    const b = generateId("test");
    expect(a).toMatch(/^test_/);
    expect(a).not.toBe(b);
  });
});

// ─── BaseAgent ────────────────────────────────────────────────────────────────

describe("BaseAgent", () => {
  const makeAgent = (overrides: Partial<AgentConfig> = {}) =>
    new MockAgent({
      name: "TestAgent",
      description: "A test agent",
      instructions: "You are a test agent.",
      ...overrides,
    });

  it("has an id", () => {
    const agent = makeAgent();
    expect(agent.id).toMatch(/^agent_/);
  });

  it("uses config.id when provided", () => {
    const agent = makeAgent({ id: "my-custom-id" });
    expect(agent.id).toBe("my-custom-id");
  });

  it("starts with idle status", () => {
    const agent = makeAgent();
    expect(agent.status).toBe("idle");
  });

  it("runs and returns output", async () => {
    const agent = makeAgent();
    const result = await agent.run("hello");
    expect(result.output).toBe("mock response");
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it("returns to idle after run", async () => {
    const agent = makeAgent();
    await agent.run("hello");
    expect(agent.status).toBe("idle");
  });

  it("calls onStep callback", async () => {
    const agent = makeAgent();
    const steps: unknown[] = [];
    await agent.run("hello", { onStep: (step) => steps.push(step) });
    expect(steps.length).toBeGreaterThan(0);
  });

  it("canHandle task with no required skill", () => {
    const agent = makeAgent();
    const task = { id: "t1", goal: "do something" } as any;
    expect(agent.canHandle(task)).toBe(true);
  });

  it("canHandle task when agent has the required skill", () => {
    const agent = makeAgent({
      skills: [
        {
          name: "summarize",
          description: "Summarizes text",
          async execute(input) {
            return { success: true, output: input };
          },
        },
      ],
    });
    expect(agent.canHandle({ requiredSkill: "summarize" } as any)).toBe(true);
    expect(agent.canHandle({ requiredSkill: "translate" } as any)).toBe(false);
  });

  it("executes tools when returned in LLM response", async () => {
    const handler = vi.fn().mockResolvedValue("tool result");
    const tool = defineTool({
      name: "my_tool",
      description: "A test tool",
      parameters: { type: "object", properties: {} },
      execute: handler,
    });

    let callCount = 0;
    class ToolCallingAgent extends BaseAgent {
      protected async callLLM(): Promise<LLMResponse> {
        callCount++;
        if (callCount === 1) {
          return {
            content: "",
            finishReason: "tool_calls",
            toolCalls: [{ id: "tc1", name: "my_tool", arguments: { x: 1 } }],
          };
        }
        return { content: "done", finishReason: "stop" };
      }
    }

    const agent = new ToolCallingAgent({
      name: "T",
      description: "",
      instructions: "",
      tools: [tool],
    });
    const result = await agent.run("use the tool");
    expect(handler).toHaveBeenCalledOnce();
    expect(result.output).toBe("done");
  });
});

// ─── RuleEngine ───────────────────────────────────────────────────────────────

describe("RuleEngine", () => {
  const ctx: AgentContext = { agentId: "a1", sessionId: "s1" };

  it("allows action when no rules", async () => {
    const engine = new RuleEngine();
    const result = await engine.validate({ type: "tool_call", payload: {} }, ctx);
    expect(result.allowed).toBe(true);
  });

  it("blocks tool with blockToolsRule", async () => {
    const engine = new RuleEngine([blockToolsRule(["dangerous_tool"])]);
    const result = await engine.validate(
      { type: "tool_call", payload: { name: "dangerous_tool" } },
      ctx,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("dangerous_tool");
  });

  it("allows tool not in blocklist", async () => {
    const engine = new RuleEngine([blockToolsRule(["dangerous_tool"])]);
    const result = await engine.validate(
      { type: "tool_call", payload: { name: "safe_tool" } },
      ctx,
    );
    expect(result.allowed).toBe(true);
  });

  it("requireAuthRule blocks when no userId", async () => {
    const engine = new RuleEngine([requireAuthRule()]);
    const result = await engine.validate({ type: "tool_call", payload: {} }, ctx);
    expect(result.allowed).toBe(false);
  });

  it("requireAuthRule allows when userId present", async () => {
    const engine = new RuleEngine([requireAuthRule()]);
    const result = await engine.validate(
      { type: "tool_call", payload: {} },
      { ...ctx, userId: "user_1" },
    );
    expect(result.allowed).toBe(true);
  });
});

// ─── TaskQueue ────────────────────────────────────────────────────────────────

describe("TaskQueue", () => {
  it("creates a task with generated id and pending status", () => {
    const q = new TaskQueue();
    const task = q.create({ goal: "do something", input: {} });
    expect(task.id).toMatch(/^task_/);
    expect(task.status).toBe("pending");
  });

  it("updates task status", () => {
    const q = new TaskQueue();
    const task = q.create({ goal: "do something", input: {} });
    const updated = q.update(task.id, { status: "running" });
    expect(updated.status).toBe("running");
  });

  it("getReady returns tasks with no dependencies", () => {
    const q = new TaskQueue();
    const t1 = q.create({ goal: "first", input: {} });
    const t2 = q.create({ goal: "second", input: {}, dependsOn: [t1.id] });
    const ready = q.getReady();
    expect(ready.map((t) => t.id)).toContain(t1.id);
    expect(ready.map((t) => t.id)).not.toContain(t2.id);
  });

  it("getReady includes dependent task once dependency is done", () => {
    const q = new TaskQueue();
    const t1 = q.create({ goal: "first", input: {} });
    const t2 = q.create({ goal: "second", input: {}, dependsOn: [t1.id] });
    q.update(t1.id, { status: "done" });
    const ready = q.getReady();
    expect(ready.map((t) => t.id)).toContain(t2.id);
  });
});

// ─── InMemoryStore ────────────────────────────────────────────────────────────

describe("InMemoryStore", () => {
  it("saves and retrieves an entry", async () => {
    const store = new InMemoryStore();
    const saved = await store.save({ content: "hello world" });
    expect(saved.id).toMatch(/^mem_/);
    const found = await store.get(saved.id);
    expect(found?.content).toBe("hello world");
  });

  it("searches by content", async () => {
    const store = new InMemoryStore();
    await store.save({ content: "TypeScript is great" });
    await store.save({ content: "Python is also great" });
    const results = await store.search("TypeScript");
    expect(results.length).toBe(1);
    expect(results[0]!.content).toContain("TypeScript");
  });

  it("deletes an entry", async () => {
    const store = new InMemoryStore();
    const saved = await store.save({ content: "to be deleted" });
    await store.delete(saved.id);
    const found = await store.get(saved.id);
    expect(found).toBeNull();
  });

  it("clears all entries", async () => {
    const store = new InMemoryStore();
    await store.save({ content: "one" });
    await store.save({ content: "two" });
    await store.clear();
    const results = await store.search("one");
    expect(results.length).toBe(0);
  });
});
