import type {
  Knowledge,
  KnowledgePage,
  Pipeline,
  PipelineDetail,
  PipelineRun,
  PipelineRunDetail,
  PipelineStage,
  Procedure,
  SkillExport,
  Specialist,
  Tool,
  ToolRunResult,
} from "../types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Hanya set Content-Type json KALAU ada body. Fastify nolak (400
  // FST_ERR_CTP_EMPTY_JSON_BODY) kalau content-type json dikirim tanpa body —
  // mis. POST /api/pipelines/:id/run yang memang tanpa payload.
  const hasBody = init?.body != null;
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (hasBody) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      message = JSON.parse(body).error ?? body;
    } catch {
      /* keep raw body */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Specialists
  listSpecialists: () => request<Specialist[]>("/api/specialists"),
  createSpecialist: (body: { name: string; description: string }) =>
    request<Specialist>("/api/specialists", { method: "POST", body: JSON.stringify(body) }),
  updateSpecialist: (id: number, body: { name: string; description: string }) =>
    request<Specialist>(`/api/specialists/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteSpecialist: (id: number) => request<{ ok: boolean }>(`/api/specialists/${id}`, { method: "DELETE" }),

  // Tools
  listTools: (specialistId: number) => request<Tool[]>(`/api/specialists/${specialistId}/tools`),
  createTool: (
    specialistId: number,
    body: { name: string; description: string; type: Tool["type"]; procedure_id: number | null }
  ) =>
    request<Tool>(`/api/specialists/${specialistId}/tools`, { method: "POST", body: JSON.stringify(body) }),
  updateTool: (id: number, body: { name: string; description: string; type: Tool["type"]; procedure_id: number | null }) =>
    request<Tool>(`/api/tools/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTool: (id: number) => request<{ ok: boolean }>(`/api/tools/${id}`, { method: "DELETE" }),

  // Procedures
  listProcedures: (specialistId: number) => request<Procedure[]>(`/api/specialists/${specialistId}/procedures`),
  createProcedure: (specialistId: number, body: { name: string; description: string; template: string }) =>
    request<Procedure>(`/api/specialists/${specialistId}/procedures`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProcedure: (id: number, body: { name: string; description: string; template: string }) =>
    request<Procedure>(`/api/procedures/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteProcedure: (id: number) => request<{ ok: boolean }>(`/api/procedures/${id}`, { method: "DELETE" }),

  // Knowledge
  listKnowledge: (specialistId: number) => request<Knowledge[]>(`/api/specialists/${specialistId}/knowledge`),
  listKnowledgePaged: (specialistId: number, page = 1, limit = 10) =>
    request<KnowledgePage>(`/api/specialists/${specialistId}/knowledge?page=${page}&limit=${limit}`),
  getKnowledge: (id: number) => request<Knowledge>(`/api/knowledge/${id}`),
  createKnowledge: (specialistId: number, body: { title: string; content: string; source: string }) =>
    request<Knowledge>(`/api/specialists/${specialistId}/knowledge`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteKnowledge: (id: number) => request<{ ok: boolean }>(`/api/knowledge/${id}`, { method: "DELETE" }),

  // Playground
  runTool: (specialistId: number, toolId: number, prompt: string) =>
    request<ToolRunResult>(`/api/specialists/${specialistId}/playground`, {
      method: "POST",
      body: JSON.stringify({ tool_id: toolId, input: { prompt } }),
    }),

  // Pipelines
  listPipelines: () => request<Pipeline[]>("/api/pipelines"),
  createPipeline: (body: { name: string; description: string }) =>
    request<Pipeline>("/api/pipelines", { method: "POST", body: JSON.stringify(body) }),
  getPipeline: (id: number) => request<PipelineDetail>(`/api/pipelines/${id}`),
  updatePipeline: (id: number, body: { name: string; description: string }) =>
    request<Pipeline>(`/api/pipelines/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePipeline: (id: number) => request<{ ok: boolean }>(`/api/pipelines/${id}`, { method: "DELETE" }),

  addStage: (pipelineId: number, body: { specialist_id: number; name: string; instruction: string; max_iterations?: number }) =>
    request<PipelineStage>(`/api/pipelines/${pipelineId}/stages`, { method: "POST", body: JSON.stringify(body) }),
  updateStage: (id: number, body: Partial<{ specialist_id: number; name: string; instruction: string; max_iterations: number }>) =>
    request<PipelineStage>(`/api/stages/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteStage: (id: number) => request<{ ok: boolean }>(`/api/stages/${id}`, { method: "DELETE" }),
  reorderStages: (pipelineId: number, stage_ids: number[]) =>
    request<{ ok: boolean }>(`/api/pipelines/${pipelineId}/stages/reorder`, {
      method: "PUT",
      body: JSON.stringify({ stage_ids }),
    }),

  runPipeline: (pipelineId: number) =>
    request<PipelineRunDetail>(`/api/pipelines/${pipelineId}/run`, { method: "POST" }),
  listRuns: (pipelineId: number) => request<PipelineRun[]>(`/api/pipelines/${pipelineId}/runs`),
  getRun: (runId: number) => request<PipelineRunDetail>(`/api/runs/${runId}`),

  // Skill export — pipeline → SKILL.md + knowledge bundle
  exportPipelineSkill: (pipelineId: number) =>
    request<SkillExport>(`/api/pipelines/${pipelineId}/export`),
  exportPipelineSkillZipUrl: (pipelineId: number) => `/api/pipelines/${pipelineId}/export?format=zip`,
};
