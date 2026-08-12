export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface LlmClient {
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
}

export class OpenAiCompatibleLlmClient implements LlmClient {
  constructor(
    private readonly cfg: { baseUrl: string; apiKey: string; model: string }
  ) {}

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 4096,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 500)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("LLM returned empty content");
    return content;
  }
}
