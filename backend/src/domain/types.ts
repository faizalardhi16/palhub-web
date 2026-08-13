export type ToolType = "crawl" | "generate_doc" | "knowledge_query" | "web_search";

export interface Specialist {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

export interface Procedure {
  id: number;
  specialist_id: number;
  name: string;
  description: string;
  template: string;
  created_at: string;
}

export interface Tool {
  id: number;
  specialist_id: number;
  name: string;
  description: string;
  type: ToolType;
  procedure_id: number | null;
  created_at: string;
}

export interface Knowledge {
  id: number;
  specialist_id: number;
  title: string;
  content: string;
  source: string;
  created_at: string;
}

export interface KnowledgePage {
  items: Knowledge[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SpecialistSummary extends Specialist {
  tool_count: number;
  procedure_count: number;
  knowledge_count: number;
}

export const TOOL_TYPES: ToolType[] = ["crawl", "generate_doc", "knowledge_query"];

// --- Pipeline Orchestrator ---

export interface Pipeline {
  id: number;
  name: string;
  description: string;
  stage_count: number;
  created_at: string;
}

export interface PipelineStage {
  id: number;
  pipeline_id: number;
  position: number;
  specialist_id: number;
  name: string;
  instruction: string;
  max_iterations: number;
}

export interface PipelineDetail extends Pipeline {
  stages: PipelineStage[];
}

export interface PipelineRun {
  id: number;
  pipeline_id: number;
  status: "running" | "done" | "failed";
  started_at: string;
  finished_at: string | null;
  error: string;
}

export type PipelineEventKind =
  | "stage_start"
  | "stage_done"
  | "need_more"
  | "resolve"
  | "answer"
  | "stage_failed"
  | "pipeline_done"
  | "pipeline_failed";

export interface PipelineRunEvent {
  id: number;
  run_id: number;
  stage_position: number | null;
  specialist_id: number | null;
  kind: PipelineEventKind;
  content: string;
  created_at: string;
}

export interface PipelineRunDetail extends PipelineRun {
  events: PipelineRunEvent[];
}
