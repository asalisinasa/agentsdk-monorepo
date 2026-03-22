// ─── LLM Provider abstraction ────────────────────────────────────────────────

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: { inputTokens: number; outputTokens: number };
  finishReason?: "stop" | "tool_calls" | "length" | "error";
}

export interface LLMProvider {
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  stream?(messages: LLMMessage[], options?: LLMOptions): AsyncIterable<string>;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  signal?: AbortSignal;
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: AgentContext,
) => Promise<unknown>;

export interface Tool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

// ─── Skills ──────────────────────────────────────────────────────────────────

export interface SkillResult {
  success: boolean;
  output: unknown;
  error?: string;
  tokensUsed?: number;
}

export interface Skill {
  name: string;
  description: string;
  requiredTools?: string[];
  execute(input: string, context: AgentContext): Promise<SkillResult>;
}

// ─── Rules ───────────────────────────────────────────────────────────────────

export interface RuleResult {
  allowed: boolean;
  reason?: string;
}

export interface Rule {
  name: string;
  description: string;
  check(action: AgentAction, context: AgentContext): Promise<RuleResult>;
}

export interface AgentAction {
  type: "tool_call" | "message" | "skill_execute" | "task_complete";
  payload: unknown;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "cancelled"
  | "awaiting_approval";

export interface Task {
  id: string;
  goal: string;
  input: Record<string, unknown>;
  output?: unknown;
  status: TaskStatus;
  requiredSkill?: string;
  assignedTo?: string; // agent id
  dependsOn?: string[]; // task ids
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskUpdate {
  status?: TaskStatus;
  output?: unknown;
  assignedTo?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  goal: string;
  tasks: Task[];
  createdAt: Date;
  status: "draft" | "executing" | "done" | "failed";
}

// ─── Memory ──────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface MemoryStore {
  save(entry: Omit<MemoryEntry, "id" | "createdAt">): Promise<MemoryEntry>;
  search(query: string, limit?: number): Promise<MemoryEntry[]>;
  get(id: string): Promise<MemoryEntry | null>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

// ─── Agent Context ────────────────────────────────────────────────────────────

export interface AgentContext {
  agentId: string;
  sessionId: string;
  userId?: string;
  memory?: MemoryStore;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export type AgentStatus = "idle" | "running" | "error";

export interface AgentConfig {
  id?: string;
  name: string;
  description: string;
  instructions: string;
  model?: string;
  tools?: Tool[];
  skills?: Skill[];
  rules?: Rule[];
  memory?: MemoryStore;
  maxIterations?: number;
  provider?: LLMProvider;
  metadata?: Record<string, unknown>;
}

export interface AgentRunOptions {
  sessionId?: string;
  userId?: string;
  context?: Partial<AgentContext>;
  signal?: AbortSignal;
  onStep?: (step: AgentStep) => void;
}

export interface AgentStep {
  type: "thinking" | "tool_call" | "tool_result" | "message" | "error";
  content: unknown;
  timestamp: Date;
}

export interface AgentRunResult {
  output: string;
  steps: AgentStep[];
  tokensUsed?: number;
  taskId?: string;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export interface OrchestratorConfig {
  agents: Agent[];
  planner?: Planner;
  defaultProvider?: LLMProvider;
  maxConcurrentTasks?: number;
}

// Forward declarations — implemented in their own modules
export interface Agent {
  id: string;
  config: AgentConfig;
  status: AgentStatus;
  run(goal: string, options?: AgentRunOptions): Promise<AgentRunResult>;
  stream?(goal: string, options?: AgentRunOptions): AsyncIterable<AgentStep>;
  canHandle(task: Task): boolean;
}

export interface Planner {
  createPlan(goal: string, context?: AgentContext): Promise<Plan>;
  validatePlan(plan: Plan): Promise<{ valid: boolean; issues?: string[] }>;
}
