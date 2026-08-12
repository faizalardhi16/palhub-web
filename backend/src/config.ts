import "dotenv/config";

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface SearchConfig {
  provider: "duckduckgo" | "serper";
  apiKey: string;
}

export interface AppConfig {
  port: number;
  dataDir: string;
  llm: LlmConfig;
  search: SearchConfig;
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 8787),
  dataDir: process.env.DATA_DIR ?? "./data",
  llm: {
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1",
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "deepseek-chat",
  },
  search: {
    provider: (process.env.SEARCH_PROVIDER as SearchConfig["provider"]) ?? "duckduckgo",
    apiKey: process.env.SEARCH_API_KEY ?? "",
  },
};
