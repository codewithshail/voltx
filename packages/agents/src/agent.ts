// @voltx/agents — ReAct agent loop with real LLM tool calling
//
// Pattern:
//   1. User message → LLM (with system prompt + tools)
//   2. LLM responds with tool_calls? → Execute tools → Feed results back → Go to 2
//   3. LLM responds with text (no tool_calls) → Return final answer
//   4. Max iterations reached → Return partial answer with warning

import { generateText } from "@voltx/ai";
import type { Message as AIMessage, ToolDefinition, TokenUsage } from "@voltx/ai";
import type {
  AgentConfig,
  AgentResponse,
  AgentStep,
  AgentToolCall,
  AgentToolExecution,
  AgentFinishReason,
  Tool,
} from "./types.js";
import { generateRunId } from "./tracer.js";

export class Agent {
  public config: AgentConfig;
  private toolMap: Map<string, Tool>;

  constructor(config: AgentConfig) {
    this.config = {
      maxIterations: 10,
      temperature: 0.7,
      ...config,
    };

    // Index tools by name for fast lookup
    this.toolMap = new Map();
    for (const tool of this.config.tools ?? []) {
      this.toolMap.set(tool.name, tool);
    }
  }

  /** Register a tool at runtime */
  addTool(tool: Tool): this {
    if (!this.config.tools) this.config.tools = [];
    this.config.tools.push(tool);
    this.toolMap.set(tool.name, tool);
    return this;
  }

  /** Run the agent with a user message (ReAct loop) */
  async run(input: string, conversationId = "default"): Promise<AgentResponse> {
    const { memory, instructions, model, maxIterations, temperature, maxTokens, tracer } = this.config;
    const runId = generateRunId();

    // Start tracing if tracer is configured
    tracer?.startRun(runId, this.config.name, model ?? "unknown");

    // Build conversation messages
    const messages: AIMessage[] = [];

    // Load history from memory
    if (memory) {
      try {
        const history = await memory.get(conversationId);
        for (const msg of history) {
          messages.push({ role: msg.role, content: msg.content });
        }
      } catch (err) {
        tracer?.completeRun(runId, "error", { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, String(err));
        throw err;
      }
    }

    // Add the new user message
    messages.push({ role: "user", content: input });

    // Store user message in memory
    if (memory) {
      await memory.add(conversationId, { role: "user", content: input });
    }

    // Build tool definitions for the LLM
    const tools = this.buildToolDefinitions();

    // ReAct loop
    const steps: AgentStep[] = [];
    const totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let finishReason: AgentFinishReason = "complete";
    let finalText = "";
    let error: string | undefined;

    try {
      for (let i = 0; i < (maxIterations ?? 10); i++) {
        // Step: Call the LLM
        const result = await generateText({
          model: model!,
          system: instructions,
          messages,
          tools: Object.keys(tools).length > 0 ? tools : undefined,
          temperature,
          maxTokens,
        });

        // Accumulate usage
        totalUsage.promptTokens += result.usage.promptTokens;
        totalUsage.completionTokens += result.usage.completionTokens;
        totalUsage.totalTokens += result.usage.totalTokens;

        // Record the LLM call step
        const llmStep: AgentStep = {
          index: steps.length + 1,
          type: "llm_call",
          text: result.text,
          toolCalls: result.toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            args: tc.args,
          })),
          usage: result.usage,
          finishReason: result.finishReason,
          timestamp: Date.now(),
        };
        steps.push(llmStep);
        this.config.onStep?.(llmStep);
        tracer?.recordStep(runId, llmStep);

        // If no tool calls, we're done
        if (result.toolCalls.length === 0 || result.finishReason !== "tool_calls") {
          finalText = result.text;
          finishReason = "complete";
          break;
        }

        // Add assistant message with tool calls to conversation
        messages.push({
          role: "assistant",
          content: result.text || "",
          tool_calls: result.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        });

        // Execute each tool call
        for (const toolCall of result.toolCalls) {
          const execution = await this.executeTool(toolCall.id, toolCall.name, toolCall.args);

          // Record the tool execution step
          const toolStep: AgentStep = {
            index: steps.length + 1,
            type: "tool_call",
            toolExecution: execution,
            timestamp: Date.now(),
          };
          steps.push(toolStep);
          this.config.onStep?.(toolStep);
          tracer?.recordStep(runId, toolStep);

          // Add tool result to conversation
          const resultStr = execution.error
            ? `Error: ${execution.error}`
            : typeof execution.result === "string"
              ? execution.result
              : JSON.stringify(execution.result);

          messages.push({
            role: "tool",
            content: resultStr,
            tool_call_id: toolCall.id,
          });
        }

        // Check if we've hit max iterations (next iteration would exceed)
        if (i === (maxIterations ?? 10) - 1) {
          finalText = result.text || "[Agent reached max iterations]";
          finishReason = "max_iterations";
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      finishReason = "error";
      finalText = `[Error: ${error}]`;
    }

    // Store assistant response in memory
    if (memory && finalText && finishReason !== "error") {
      await memory.add(conversationId, { role: "assistant", content: finalText });
    }

    // Complete trace
    tracer?.completeRun(runId, finishReason, totalUsage, error);

    return { content: finalText, steps, usage: totalUsage, finishReason };
  }

  /** Build tool definitions in the format @voltx/ai expects */
  private buildToolDefinitions(): Record<string, ToolDefinition> {
    const defs: Record<string, ToolDefinition> = {};
    for (const tool of this.config.tools ?? []) {
      defs[tool.name] = {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters ?? { type: "object", properties: {} },
      };
    }
    return defs;
  }

  /** Execute a single tool call */
  private async executeTool(
    _id: string,
    name: string,
    args: Record<string, unknown>,
  ): Promise<AgentToolExecution> {
    const tool = this.toolMap.get(name);
    const start = Date.now();

    if (!tool) {
      return {
        toolName: name,
        args,
        result: null,
        durationMs: Date.now() - start,
        error: `Tool "${name}" not found`,
      };
    }

    this.config.onToolCall?.(name, args);

    try {
      const result = await tool.execute(args);
      const durationMs = Date.now() - start;
      this.config.onToolResult?.(name, result);
      return { toolName: name, args, result, durationMs };
    } catch (err) {
      const durationMs = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);
      return { toolName: name, args, result: null, durationMs, error };
    }
  }
}
