import type { AgentStep } from "@agentsdk/core";

// ─── Message ──────────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant";
export type MessageStatus = "streaming" | "done" | "error";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  steps?: AgentStep[];
  createdAt: Date;
}

// ─── Agent config ─────────────────────────────────────────────────────────────

export interface AgentConfig {
  /**
   * The API endpoint to POST requests to.
   * @example "/api/agent"
   */
  endpoint: string;

  /**
   * Optional auth token — sent as Authorization: Bearer <token>.
   */
  token?: string;

  /**
   * Optional session ID — sent in the request body.
   */
  sessionId?: string;

  /**
   * Optional extra headers to send with each request.
   */
  headers?: Record<string, string>;
}

// ─── useAgent state ───────────────────────────────────────────────────────────

export type AgentStatus = "idle" | "streaming" | "error";

export interface UseAgentReturn {
  /** All messages in the current conversation */
  messages: Message[];

  /** Current status of the agent */
  status: AgentStatus;

  /** Last error message, if any */
  error: string | null;

  /** Send a goal to the agent */
  send: (goal: string) => Promise<void>;

  /** Abort the current agent run */
  abort: () => void;

  /** Clear all messages */
  clear: () => void;

  /** Whether the agent is currently streaming */
  isStreaming: boolean;
}

// ─── SSE event from @agentsdk/next ───────────────────────────────────────────

export interface SSEEvent {
  type: "thinking" | "tool_call" | "tool_result" | "message" | "error" | "text-delta";
  content: unknown;
  timestamp?: string;
}
