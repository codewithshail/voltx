// @voltx/agents — Agent tracing and observability
//
// Provides lightweight tracing for agent runs including:
// - Step-by-step recording (LLM calls, tool executions)
// - Token usage and cost estimation
// - Timing per step and total duration
//
// Usage:
//   const tracer = new AgentTracer();
//   const agent = createAgent({ name: "assistant", model: "...", tracer });
//   const result = await agent.run("Hello");
//   console.log(tracer.latestRun());

import type { TokenUsage } from "@voltx/ai";
import type { AgentStep } from "./types.js";

/** Cost per 1M tokens (prompt, completion) for common providers */
const COST_PER_MTOKENS: Record<string, [number, number]> = {
  openai: [2.5, 10.0],        // gpt-4o
  "openai:gpt-4o-mini": [0.15, 0.6],
  anthropic: [3.0, 15.0],     // claude-3-sonnet
  google: [0.075, 0.3],       // gemini-1.5-flash
  cerebras: [0.0, 0.0],       // free tier varies
  openrouter: [0.0, 0.0],     // varies by model
  ollama: [0.0, 0.0],         // local / free
};

export interface AgentTrace {
  runId: string;
  agentName: string;
  model: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  steps: AgentStep[];
  totalUsage: TokenUsage;
  estimatedCostUsd: number;
  finishReason?: string;
  error?: string;
}

export interface TracerOptions {
  /** Max traces to keep in memory (default: 100) */
  maxTraces?: number;
  /** Custom cost map: provider → [promptPer1M, completionPer1M] */
  costMap?: Record<string, [number, number]>;
  /** Called synchronously on every new step */
  onStep?: (trace: AgentTrace, step: AgentStep) => void;
  /** Called when a run completes */
  onComplete?: (trace: AgentTrace) => void;
}

/** Lightweight in-memory tracer for agent runs */
export class AgentTracer {
  private traces: AgentTrace[] = [];
  private activeTraces = new Map<string, AgentTrace>();
  private maxTraces: number;
  private costMap: Record<string, [number, number]>;
  private onStep?: TracerOptions["onStep"];
  private onComplete?: TracerOptions["onComplete"];

  constructor(options: TracerOptions = {}) {
    this.maxTraces = options.maxTraces ?? 100;
    this.costMap = options.costMap ?? COST_PER_MTOKENS;
    this.onStep = options.onStep;
    this.onComplete = options.onComplete;
  }

  /** Start a new trace for an agent run */
  startRun(runId: string, agentName: string, model: string): AgentTrace {
    const trace: AgentTrace = {
      runId,
      agentName,
      model,
      startTime: Date.now(),
      steps: [],
      totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      estimatedCostUsd: 0,
    };
    this.activeTraces.set(runId, trace);
    return trace;
  }

  /** Record a step in an active trace */
  recordStep(runId: string, step: AgentStep): void {
    const trace = this.activeTraces.get(runId);
    if (!trace) return;

    trace.steps.push(step);

    if (step.type === "llm_call" && step.usage) {
      trace.totalUsage.promptTokens += step.usage.promptTokens;
      trace.totalUsage.completionTokens += step.usage.completionTokens;
      trace.totalUsage.totalTokens += step.usage.totalTokens;
      trace.estimatedCostUsd = this.estimateCost(trace.model, trace.totalUsage);
    }

    this.onStep?.(trace, step);
  }

  /** Mark a run as complete */
  completeRun(
    runId: string,
    finishReason: string,
    usage: TokenUsage,
    error?: string
  ): AgentTrace | undefined {
    const trace = this.activeTraces.get(runId);
    if (!trace) return;

    trace.endTime = Date.now();
    trace.durationMs = trace.endTime - trace.startTime;
    trace.finishReason = finishReason;
    trace.totalUsage = usage;
    trace.estimatedCostUsd = this.estimateCost(trace.model, usage);
    if (error) trace.error = error;

    this.activeTraces.delete(runId);
    this.traces.push(trace);

    // Enforce max trace buffer
    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(-this.maxTraces);
    }

    this.onComplete?.(trace);
    return trace;
  }

  /** Get all completed traces */
  getTraces(): AgentTrace[] {
    return [...this.traces];
  }

  /** Get the most recent completed trace */
  latestTrace(): AgentTrace | undefined {
    return this.traces[this.traces.length - 1];
  }

  /** Get an active (in-progress) trace */
  getActiveTrace(runId: string): AgentTrace | undefined {
    return this.activeTraces.get(runId);
  }

  /** Clear all traces */
  clear(): void {
    this.traces = [];
    this.activeTraces.clear();
  }

  private estimateCost(model: string, usage: TokenUsage): number {
    const provider = model.includes(":") ? model.split(":")[0] : model;
    const [promptCost, completionCost] = this.costMap[provider] ?? [0, 0];
    const prompt = usage.promptTokens / 1_000_000;
    const completion = usage.completionTokens / 1_000_000;
    return prompt * promptCost + completion * completionCost;
  }
}

/** Generate a short random run ID */
export function generateRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
