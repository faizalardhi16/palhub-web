import type { LlmClient } from "../llm/client.js";
import type { EmbeddingService } from "../services/embedding.service.js";
import type { KnowledgeService } from "../services/knowledge.service.js";
import type { Procedure, Specialist, Tool } from "../domain/types.js";

export interface ToolExecutionContext {
  specialist: Specialist;
  tool: Tool;
  input: Record<string, unknown>;
  llm: LlmClient;
  knowledge: KnowledgeService;
  procedure?: Procedure;
  dataDir: string;
  /** Optional — executor yang nyimpen knowledge wajib trigger backfill biar
   *  note baru ke-embed (semantic search). Fire-and-forget, error di-swallow. */
  embedding?: EmbeddingService;
}

export interface ToolExecutionResult {
  content: string;
  artifacts: string[];
}

/**
 * ToolExecutor — single responsibility: execute one tool type.
 * New tool types = new executor class + register. No if-else chains (Open/Closed).
 */
export interface ToolExecutor {
  readonly type: string;
  execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult>;
}
