import { ChatUI } from "@agentsdk/react";

export default function Page() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>agentsdk example</h1>
      <ChatUI
        config={{ endpoint: "/api/agent", token: "my-key" }}
        welcomeMessage="Hi! How can I help you today?"
        placeholder="Ask me anything..."
      />
    </main>
  );
}
