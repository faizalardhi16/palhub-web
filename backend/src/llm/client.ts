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
    // Retry 3x — DeepSeek peak hours sering balikin empty content / 5xx transient
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
      try {
        const content = await this.chatOnce(messages, opts);
        if (content.trim()) return content;
        lastError = new Error("LLM returned empty content");
      } catch (error) {
        lastError = error as Error;
        const status = (error as Error & { status?: number }).status;
        // 429/5xx = transient, retry; 400 = jangan retry
        if (status !== undefined && status < 500 && status !== 429) break;
      }
    }
    throw lastError ?? new Error("LLM request failed");
  }

  private async chatOnce(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
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
      const error = new Error(`LLM request failed (${res.status}): ${text.slice(0, 500)}`);
      (error as Error & { status?: number }).status = res.status;
      throw error;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}
