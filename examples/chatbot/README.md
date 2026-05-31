# Chatbot Example

A minimal streaming chatbot built with VoltX.

## Features

- Streaming chat UI with React SSR
- Conversation memory
- File-based routing (`src/pages/`, `api/`)

## Project Structure

```
chatbot/
├── api/chat.ts         — POST /api/chat (streaming endpoint)
├── src/pages/index.tsx — Home page with chat UI
├── src/layout.tsx      — Root layout
└── server.ts           — Hono app entry
```

## Key Code

### API Route

```ts
// api/chat.ts
import type { Context } from "@voltx/server";
import { streamText } from "@voltx/ai";

export async function POST(c: Context) {
  const { messages } = await c.req.json();
  const result = await streamText({
    model: "cerebras:llama3.1-8b",
    messages,
  });
  return result.toSSEResponse();
}
```

### Frontend

```tsx
// src/pages/index.tsx
import { useChat } from "@voltx/ui";

export default function ChatPage() {
  const { messages, input, setInput, sendMessage, isLoading } = useChat({
    api: "/api/chat",
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>{m.role}: {m.content}</div>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
      />
    </div>
  );
}
```

## Run

```bash
npx create-voltx-app my-chat --template chatbot --yes
cd my-chat
npm run dev
```
