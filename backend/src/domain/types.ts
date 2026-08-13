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
