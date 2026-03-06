<p align="center">
  <strong>@voltx/ui</strong><br/>
  <em>React hooks for AI-powered interfaces — useChat, useAgent</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@voltx/ui"><img src="https://img.shields.io/npm/v/@voltx/ui?color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@voltx/ui"><img src="https://img.shields.io/npm/dm/@voltx/ui" alt="downloads" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@voltx/ui" alt="license" /></a>
</p>

---

React hooks for building AI chat interfaces. Part of the [VoltX](https://github.com/codewithshail/voltx) framework.

## Installation

```bash
npm install @voltx/ui
```

> Requires `react` as a peer dependency.

## useChat

Full-featured chat hook with message management, loading states, and error handling.

```tsx
import { useChat } from "@voltx/ui";

function ChatPage() {
  const { messages, input, setInput, sendMessage, isLoading, error, reset } = useChat({
    api: "/api/chat",
  });

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}

      <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

### Options

```ts
useChat({
  api: "/api/chat",              // API endpoint (default: "/api/chat")
  initialMessages: [],           // Pre-populate messages
  onResponse: (res) => {},       // Called when response is received
  onError: (err) => {},          // Called on error
});
```

### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `messages` | `ChatMessage[]` | All messages in the conversation |
| `input` | `string` | Current input value |
| `setInput` | `function` | Update input value |
| `sendMessage` | `function` | Send a message |
| `isLoading` | `boolean` | Whether a request is in progress |
| `error` | `Error \| null` | Last error |
| `reset` | `function` | Clear all messages |

## useAgent

Hook for interacting with VoltX agents.

```tsx
import { useAgent } from "@voltx/ui";

function AgentPage() {
  const { run, isRunning, error } = useAgent({
    api: "/api/agent",
    agentName: "assistant",
  });

  const handleRun = async () => {
    const result = await run("What's the weather in Tokyo?");
    console.log(result);
  };

  return (
    <button onClick={handleRun} disabled={isRunning}>
      {isRunning ? "Thinking..." : "Ask Agent"}
    </button>
  );
}
```

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
