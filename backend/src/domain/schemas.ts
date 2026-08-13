import { z } from "zod";

export const specialistCreateSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(80),
  description: z.string().max(2000).default(""),
});

export const specialistUpdateSchema = specialistCreateSchema;

export const procedureCreateSchema = z.object({
  name: z.string().min(1, "Nama procedure wajib diisi").max(120),
  description: z.string().max(2000).default(""),
  template: z.string().min(1, "Template wajib diisi").max(50_000),
});

export const procedureUpdateSchema = procedureCreateSchema;

export const toolCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Nama tool wajib diisi")
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Nama tool: huruf kecil, angka, underscore (contoh: generate_doc)"),
  description: z.string().max(2000).default(""),
  type: z.enum(["crawl", "generate_doc", "knowledge_query", "web_search"]),
  procedure_id: z.number().int().positive().nullable().default(null),
});

export const toolUpdateSchema = toolCreateSchema;

export const knowledgeCreateSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi").max(200),
  content: z.string().min(1, "Konten wajib diisi").max(100_000),
  source: z.string().max(1000).default(""),
});

export const playgroundSchema = z.object({
  tool_id: z.number().int().positive(),
  input: z
    .object({
      prompt: z.string().min(1, "Prompt wajib diisi").max(10_000),
    })
    .default({ prompt: "" }),
});

export const pipelineCreateSchema = z.object({
  name: z.string().min(1, "Nama pipeline wajib diisi").max(120),
  description: z.string().max(5000).default(""),
});

export const pipelineUpdateSchema = pipelineCreateSchema;

export const pipelineStageCreateSchema = z.object({
  specialist_id: z.number().int().positive(),
  name: z.string().min(1, "Nama stage wajib diisi").max(120),
  instruction: z.string().max(50_000).default(""),
  max_iterations: z.number().int().min(1).max(10).default(3),
});

export const pipelineStageUpdateSchema = z.object({
  specialist_id: z.number().int().positive().optional(),
  name: z.string().min(1).max(120).optional(),
  instruction: z.string().max(50_000).optional(),
  max_iterations: z.number().int().min(1).max(10).optional(),
});

export const pipelineStageReorderSchema = z.object({
  stage_ids: z.array(z.number().int().positive()).min(2),
});
