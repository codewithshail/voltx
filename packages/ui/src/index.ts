// @voltx/ui — React hooks for AI features

import { useState, useCallback, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

export interface UseChatOptions {
  /** API endpoint for chat */
  api?: string;
  /** Initial messages */
  initialMessages?: ChatMessage[];
  /** Called when a response is received */
  onResponse?: (response: Response) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (input: string) => void;
  sendMessage: (content?: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

// ─── useChat ─────────────────────────────────────────────────────────────────

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { api = "/api/chat", initialMessages = [], onResponse, onError } = options;

  const messagesRef = useRef<ChatMessage[]>(initialMessages);

  const [messages, _setMessages] = useState<ChatMessage[]>(initialMessages);
  const setMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    _setMessages((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      messagesRef.current = next;
      return next;
    });
  }, []);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content?: string) => {
      const text = content ?? input;
      if (!text.trim()) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setError(null);

      try {
        abortRef.current = new AbortController();
        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messagesRef.current].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: abortRef.current.signal,
        });

        onResponse?.(res);

        if (!res.ok) {
          throw new Error(`Chat API error: ${res.status}`);
        }

        const data = (await res.json()) as Record<string, string>;
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data["content"] ?? data["message"] ?? "",
          createdAt: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name !== "AbortError") {
          setError(e);
          onError?.(e);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [api, input, onResponse, onError]
  );

  const reset = useCallback(() => {
    setMessages(initialMessages);
    setInput("");
    setError(null);
    abortRef.current?.abort();
  }, [initialMessages]);

  return { messages, input, setInput, sendMessage, isLoading, error, reset };
}

// ─── useAgent ────────────────────────────────────────────────────────────────

export interface UseAgentOptions {
  api?: string;
  agentName: string;
  onError?: (error: Error) => void;
}

export interface UseAgentReturn {
  run: (input: string) => Promise<string>;
  isRunning: boolean;
  error: Error | null;
}

export function useAgent(options: UseAgentOptions): UseAgentReturn {
  const { api = "/api/agent", agentName, onError } = options;
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(
    async (input: string): Promise<string> => {
      setIsRunning(true);
      setError(null);

      try {
        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent: agentName, input }),
        });

        if (!res.ok) throw new Error(`Agent API error: ${res.status}`);
        const data = (await res.json()) as Record<string, string>;
        return data["content"] ?? data["result"] ?? "";
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        onError?.(e);
        throw e;
      } finally {
        setIsRunning(false);
      }
    },
    [api, agentName, onError]
  );

  return { run, isRunning, error };
}

export const VERSION = "0.4.7";
