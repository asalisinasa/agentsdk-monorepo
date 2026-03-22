"use client";

import { useEffect, useRef, type SubmitEvent } from "react";
import type { AgentConfig, Message } from "./types.js";
import { useAgent } from "./use-agent.js";

// ─── ChatUI props ─────────────────────────────────────────────────────────────

export interface ChatUIProps {
  /**
   * Agent config — required if not wrapped in AgentProvider.
   */
  config?: AgentConfig;

  /**
   * Placeholder text for the input field.
   * @default "Send a message..."
   */
  placeholder?: string;

  /**
   * Welcome message shown when there are no messages.
   */
  welcomeMessage?: string;

  /**
   * Optional CSS class applied to the root container.
   */
  className?: string;
}

// ─── ChatUI ───────────────────────────────────────────────────────────────────

/**
 * A ready-to-use chat UI component.
 *
 * Unstyled by default — apply your own CSS or Tailwind classes.
 * For a fully styled version, use the assistant-ui Thread component
 * with createAssistantUIAdapter().
 *
 * @example minimal:
 * ```tsx
 * <ChatUI config={{ endpoint: "/api/agent" }} />
 * ```
 *
 * @example with AgentProvider:
 * ```tsx
 * <AgentProvider config={{ endpoint: "/api/agent" }}>
 *   <ChatUI placeholder="Ask me anything..." />
 * </AgentProvider>
 * ```
 */
export function ChatUI({
  config,
  placeholder = "Send a message...",
  welcomeMessage,
  className,
}: ChatUIProps) {
  const { messages, send, abort, isStreaming, error } = useAgent(config);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input?.value.trim()) return;
    const goal = input.value.trim();
    input.value = "";
    await send(goal);
  };

  return (
    <div className={className} data-agentsdk-chat="">
      {/* Messages */}
      <div data-agentsdk-messages="">
        {messages.length === 0 && welcomeMessage && (
          <p data-agentsdk-welcome="">{welcomeMessage}</p>
        )}
        {messages.map((m) => (
          <MessageItem key={m.id} message={m} />
        ))}
        {error && <p data-agentsdk-error="">{error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} data-agentsdk-form="">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          disabled={isStreaming}
          data-agentsdk-input=""
          autoComplete="off"
        />
        {isStreaming ? (
          <button type="button" onClick={abort} data-agentsdk-stop="">
            Stop
          </button>
        ) : (
          <button type="submit" data-agentsdk-send="">
            Send
          </button>
        )}
      </form>
    </div>
  );
}

// ─── MessageItem ──────────────────────────────────────────────────────────────

function MessageItem({ message }: { message: Message }) {
  return (
    <div data-agentsdk-message="" data-role={message.role} data-status={message.status}>
      <span data-agentsdk-message-content="">
        {message.content}
        {message.status === "streaming" && (
          <span data-agentsdk-cursor="" aria-hidden="true">
            ▋
          </span>
        )}
      </span>
    </div>
  );
}
