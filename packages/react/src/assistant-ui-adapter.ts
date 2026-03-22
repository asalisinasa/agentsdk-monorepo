"use client";

import type { AgentConfig } from "./types.js";

/**
 * Creates a runtime config for assistant-ui that connects to @agentsdk/next.
 *
 * Use this with useExternalStoreRuntime() from @assistant-ui/react to wire up
 * the full assistant-ui experience (Thread, markdown, code highlighting, etc.)
 * while routing requests through your @agentsdk/next route.
 *
 * @example
 * ```tsx
 * import { useExternalStoreRuntime, AssistantRuntimeProvider, Thread } from "@assistant-ui/react"
 * import { createAssistantUIAdapter } from "@agentsdk/react"
 *
 * export function Chat() {
 *   const adapter = createAssistantUIAdapter({ endpoint: "/api/agent" })
 *   const runtime = useExternalStoreRuntime(adapter)
 *
 *   return (
 *     <AssistantRuntimeProvider runtime={runtime}>
 *       <Thread />
 *     </AssistantRuntimeProvider>
 *   )
 * }
 * ```
 */
export function createAssistantUIAdapter(config: AgentConfig) {
  return {
    async run({
      messages,
      abortSignal,
      onUpdate,
    }: {
      messages: Array<{ role: string; content: { type: string; text?: string }[] }>;
      abortSignal: AbortSignal;
      onUpdate: (content: string) => void;
    }): Promise<{ content: { type: string; text: string }[] }> {
      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
      const goal = lastUserMessage?.content.find((c) => c.type === "text")?.text ?? "";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...config.headers,
      };

      if (config.token) {
        headers["Authorization"] = `Bearer ${config.token}`;
      }

      const res = await fetch(config.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          goal,
          ...(config.sessionId !== undefined && { sessionId: config.sessionId }),
        }),
        signal: abortSignal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          let event: { type: string; content: unknown };
          try {
            event = JSON.parse(payload);
          } catch {
            continue;
          }

          if (event.type === "message" || event.type === "text-delta") {
            const chunk =
              event.type === "message" ? (event.content as string) : (event.content as string);
            fullContent = event.type === "message" ? chunk : fullContent + chunk;
            onUpdate(fullContent);
          }
        }
      }

      return { content: [{ type: "text", text: fullContent }] };
    },
  };
}
