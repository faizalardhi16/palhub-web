import type { LlmClient } from "../llm/client.js";
import type { KnowledgeService } from "./knowledge.service.js";
import type { ProcedureService } from "./procedure.service.js";
import type { SpecialistService } from "./specialist.service.js";
import type { ToolService } from "./tool.service.js";
import type { ToolExecutorRegistry } from "../engines/registry.js";
import type { ToolExecutionResult } from "../engines/types.js";

export interface PlaygroundDeps {
  registry: ToolExecutorRegistry;
  specialistService: SpecialistService;
  toolService: ToolService;
  procedureService: ProcedureService;
  knowledge: KnowledgeService;
  llm: LlmClient;
  dataDir: string;
}

export class PlaygroundService {
  constructor(private readonly deps: PlaygroundDeps) {}

  async run(specialistId: number, toolId: number, input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const specialist = this.deps.specialistService.get(specialistId);
    const tool = this.deps.toolService.get(toolId);
    if (tool.specialist_id !== specialistId) {
      throw new Error("Tool bukan milik specialist ini");
    }

    const procedure = tool.procedure_id ? this.deps.procedureService.get(tool.procedure_id) : undefined;
    const executor = this.deps.registry.get(tool.type);

    return executor.execute({
      specialist,
      tool,
      input,
      llm: this.deps.llm,
      knowledge: this.deps.knowledge,
      procedure,
      dataDir: this.deps.dataDir,
    });
  }
}
