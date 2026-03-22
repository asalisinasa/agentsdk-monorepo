import type { LanguageModel } from "ai";
import { describe, expect, it, vi } from "vitest";
import { createVercelAIProvider } from "../src/index.js";

// ─── Mock AI SDK model ────────────────────────────────────────────────────────

function makeMockModel(text: string, toolCalls?: unknown[]): LanguageModel {
  return {
    specificationVersion: "v1",
    provider: "mock",
    modelId: "mock-model",
    defaultObjectGenerationMode: "json",
    doGenerate: vi.fn().mockResolvedValue({
      text,
      finishReason: toolCalls?.length ? "tool-calls" : "stop",
      toolCalls: toolCalls ?? [],
      usage: { promptTokens: 10, completionTokens: 20 },
      rawCall: { rawPrompt: "", rawSettings: {} },
    }),
    doStream: vi.fn().mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "text-delta", textDelta: text });
          controller.enqueue({
            type: "finish",
            finishReason: "stop",
            usage: { promptTokens: 10, completionTokens: 20 },
          });
          controller.close();
        },
      }),
      rawCall: { rawPrompt: "", rawSettings: {} },
    }),
  } as unknown as LanguageModel;
}

// ─── createVercelAIProvider ───────────────────────────────────────────────────

describe("createVercelAIProvider", () => {
  it("returns an LLMProvider with complete and stream", () => {
    const provider = createVercelAIProvider({ model: makeMockModel("hi") });
    expect(typeof provider.complete).toBe("function");
    expect(typeof provider.stream).toBe("function");
  });

  it("complete returns text content", async () => {
    const provider = createVercelAIProvider({ model: makeMockModel("hello world") });
    const result = await provider.complete([{ role: "user", content: "hi" }]);
    expect(result.content).toBe("hello world");
    expect(result.finishReason).toBe("stop");
  });

  it("complete maps usage tokens", async () => {
    const provider = createVercelAIProvider({ model: makeMockModel("hello") });
    const result = await provider.complete([{ role: "user", content: "hi" }]);
    expect(result.usage?.inputTokens).toBe(10);
    expect(result.usage?.outputTokens).toBe(20);
  });

  it("complete maps tool_calls finish reason", async () => {
    const provider = createVercelAIProvider({
      model: makeMockModel("", [
        { toolCallId: "tc1", toolName: "search", args: JSON.stringify({ query: "test" }) },
      ]),
    });
    const result = await provider.complete([{ role: "user", content: "search something" }], {
      tools: [
        {
          name: "search",
          description: "Search the web",
          parameters: { type: "object", properties: { query: { type: "string" } } },
        },
      ],
    });
    expect(result.finishReason).toBe("tool_calls");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls?.[0]?.name).toBe("search");
  });

  it("stream yields text chunks", async () => {
    const provider = createVercelAIProvider({ model: makeMockModel("streamed text") });
    const chunks: string[] = [];
    for await (const chunk of provider.stream!([{ role: "user", content: "hi" }])) {
      chunks.push(chunk);
    }
    expect(chunks.join("")).toBe("streamed text");
  });

  it("passes tool messages correctly", async () => {
    const model = makeMockModel("done");
    const provider = createVercelAIProvider({ model });
    await provider.complete([
      { role: "user", content: "use a tool" },
      { role: "assistant", content: "" },
      {
        role: "tool",
        content: JSON.stringify({ result: "found it" }),
        toolCallId: "tc1",
        toolName: "search",
      },
    ]);
    expect(model.doGenerate).toHaveBeenCalledOnce();
  });
});
