import type { Knowledge, Procedure, Specialist, Tool, ToolRunResult } from "../types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
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
};
