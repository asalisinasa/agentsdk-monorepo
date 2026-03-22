import type {
  AgentConfig,
  AgentContext,
  LLMMessage,
  LLMOptions,
  LLMProvider,
  LLMResponse,
} from "@agentsdk/core";
import { BaseAgent } from "@agentsdk/core";
import type { VercelAIProviderConfig } from "./provider.js";
import { createVercelAIProvider } from "./provider.js";

/**
 * Config for VercelAIAgent — extends AgentConfig with a required model.
 */
export interface VercelAIAgentConfig extends Omit<AgentConfig, "provider" | "model"> {
  /**
   * Vercel AI SDK model instance.
   * @example openai("gpt-4o")
   * @example anthropic("claude-sonnet-4-5")
   * @example google("gemini-2.0-flash")
   */
  model: VercelAIProviderConfig["model"];
  temperature?: number;
  maxTokens?: number;
}

/**
 * A ready-to-use agent backed by the Vercel AI SDK.
 *
 * Implements `callLLM()` so you only need to provide a model and instructions.
 *
 * @example
 * ```ts
 * import { openai } from "@ai-sdk/openai"
 * import { VercelAIAgent } from "@agentsdk/adapter-vercel-ai"
 *
 * const agent = new VercelAIAgent({
 *   name: "Researcher",
 *   description: "Researches topics and summarises findings",
 *   instructions: "You are a research assistant. Be concise.",
 *   model: openai("gpt-4o"),
 * })
 *
 * const result = await agent.run("What is multi-agent AI?")
 * console.log(result.output)
 * ```
 */
export class VercelAIAgent extends BaseAgent {
  private readonly aiProvider: LLMProvider;

  constructor(config: VercelAIAgentConfig) {
    const { model, temperature, maxTokens, ...agentConfig } = config;

    super(agentConfig);

    this.aiProvider = createVercelAIProvider({ model, temperature, maxTokens });
  }

  protected async callLLM(messages: LLMMessage[], context: AgentContext): Promise<LLMResponse> {
    const options: LLMOptions = {
      tools: this.config.tools?.map((t) => t.definition),
      ...(context.signal !== undefined && { signal: context.signal }),
    };

    return this.aiProvider.complete(messages, options);
  }
}
