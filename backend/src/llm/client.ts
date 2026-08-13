export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Force JSON output via response_format=json_object (kalau API support). */
  json?: boolean;
}

export interface LlmClient {
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
}

export class OpenAiCompatibleLlmClient implements LlmClient {
  constructor(
    private readonly cfg: { baseUrl: string; apiKey: string; model: string }
  ) {}

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    // Retry 5x — DeepSeek peak hours sering balikin empty content / 5xx
    // transient. Backoff exponensial: 2, 8, 18, 32s (≈60s total extra).
    // CATATAN: kalau finish_reason = "length" (max_tokens ke-habis buat
    // reasoning model berpikir) itu BUKAN transient — langsung error,
    // jangan retry 5x percuma.
    let lastError: Error | null = null;
    const attempts = 5;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) {
        const delay = 2000 * attempt * attempt;
        await new Promise((r) => setTimeout(r, delay));
      }
      try {
        const { content, finishReason } = await this.chatOnce(messages, opts);
        if (content.trim()) return content;
        if (finishReason === "length") {
          throw new Error("LLM returned empty content (max_tokens habis buat reasoning) — naikkan maxTokens");
        }
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

  private async chatOnce(
    messages: ChatMessage[],
    opts: ChatOptions = {}
  ): Promise<{ content: string; finishReason: string | null }> {
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
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      const error = new Error(`LLM request failed (${res.status}): ${text.slice(0, 500)}`);
      (error as Error & { status?: number }).status = res.status;
      throw error;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content ?? "",
      finishReason: choice?.finish_reason ?? null,
    };
  }
}
