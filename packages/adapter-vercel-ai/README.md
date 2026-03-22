# @agentsdk/adapter-vercel-ai

Vercel AI SDK adapter for `@agentsdk/core`. Implements `callLLM()` so your agents work with OpenAI, Anthropic, Google Gemini, and any other AI SDK-compatible provider — without changing a line of agent code.

## Install

```bash
pnpm add @agentsdk/core @agentsdk/adapter-vercel-ai ai

# Add the provider(s) you need
pnpm add @ai-sdk/openai      # OpenAI / Azure OpenAI
pnpm add @ai-sdk/anthropic   # Anthropic Claude
pnpm add @ai-sdk/google      # Google Gemini
```

## Usage

### Option A — VercelAIAgent (recommended)

The simplest way. Pass a model directly, no boilerplate:

```ts
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { VercelAIAgent } from "@agentsdk/adapter-vercel-ai";
import { defineTool, requireAuthRule } from "@agentsdk/core";

// OpenAI
const agent = new VercelAIAgent({
  name: "Researcher",
  description: "Researches topics and summarises findings",
  instructions: "You are a research assistant. Be concise and cite sources.",
  model: openai("gpt-4o"),
});

// Anthropic — same API, different model
const claudeAgent = new VercelAIAgent({
  name: "Writer",
  description: "Writes polished long-form content",
  instructions: "You are a professional writer. Be clear and engaging.",
  model: anthropic("claude-sonnet-4-5"),
  tools: [mySearchTool],
  rules: [requireAuthRule()],
});

// Google Gemini
const geminiAgent = new VercelAIAgent({
  name: "Analyst",
  description: "Analyses data and produces structured reports",
  instructions: "You are a data analyst. Always format output as structured data.",
  model: google("gemini-2.0-flash"),
});

const result = await agent.run("What is the current state of multi-agent AI?");
console.log(result.output);
```

### Option B — createVercelAIProvider (advanced)

Use this when you want to extend `BaseAgent` yourself but still use the AI SDK:

```ts
import { openai } from "@ai-sdk/openai";
import { BaseAgent } from "@agentsdk/core";
import { createVercelAIProvider } from "@agentsdk/adapter-vercel-ai";
import type { LLMMessage, LLMResponse, AgentContext } from "@agentsdk/core";

const provider = createVercelAIProvider({ model: openai("gpt-4o") });

class MyCustomAgent extends BaseAgent {
  protected async callLLM(messages: LLMMessage[], context: AgentContext): Promise<LLMResponse> {
    // add custom logic before/after the LLM call
    return provider.complete(messages, {
      tools: this.config.tools?.map((t) => t.definition),
    });
  }
}
```

### Streaming

```ts
for await (const step of agent.stream("Write a short essay on agentic AI")) {
  if (step.type === "message") {
    process.stdout.write(step.content as string);
  }
}
```

## Switching providers

Change one line — the rest of your agent code stays identical:

```ts
// Before
model: openai("gpt-4o");

// After
model: anthropic("claude-sonnet-4-5");
```

## How it works

`@agentsdk/core` defines a `LLMProvider` interface with `complete()` and `stream()`. This package implements that interface using the Vercel AI SDK's `generateText()` and `streamText()` functions, and handles all the type conversion between core types and AI SDK types internally.
