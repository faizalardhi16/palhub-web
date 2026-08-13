# Pipeline Orchestrator — API Spec v1.0.0

## Konsep

**Pipeline** = rangkaian stage yang dieksekusi berurutan. Tiap stage memakai **satu specialist**
(Finance, Business Analyst, dll). Specialist bisa dipanggil **ulang** oleh stage lain saat
butuh info tambahan (feedback loop).

```
Stage 1: Finance Specialist ──share──▶ Stage 2: BA ──gather──▶ Stage 3: Translate
                  ▲                                             │
                  └───── "butuh detail PPN" (need_more) ◀───────┘
                        orchestrator resolve → panggil Finance lagi
```

## Data Model (SQLite)

```sql
CREATE TABLE IF NOT EXISTS pipelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_id INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  specialist_id INTEGER NOT NULL REFERENCES specialists(id),
  name TEXT NOT NULL,
  instruction TEXT NOT NULL DEFAULT '',     -- apa yang dilakukan specialist di stage ini
  max_iterations INTEGER NOT NULL DEFAULT 3 -- batas feedback loop per stage
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_id INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',   -- running | done | failed
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  error TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pipeline_run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  stage_position INTEGER,                   -- null = orchestrator-level event
  specialist_id INTEGER,
  kind TEXT NOT NULL,                       -- stage_start | stage_done | need_more | resolve | answer | stage_failed | pipeline_done | pipeline_failed
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Endpoints

### CRUD Pipeline

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/pipelines` | - | `Pipeline[]` (dengan stage count) |
| POST | `/api/pipelines` | `{name, description}` | `Pipeline` |
| GET | `/api/pipelines/:id` | - | `PipelineDetail` (dengan stages) |
| PUT | `/api/pipelines/:id` | `{name, description}` | `Pipeline` |
| DELETE | `/api/pipelines/:id` | - | `{ok: true}` |

### Stages

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/pipelines/:id/stages` | - | `PipelineStage[]` |
| POST | `/api/pipelines/:id/stages` | `{specialist_id, name, instruction, max_iterations?}` | `PipelineStage` |
| PUT | `/api/stages/:id` | `{specialist_id?, name?, instruction?, max_iterations?}` | `PipelineStage` |
| DELETE | `/api/stages/:id` | - | `{ok: true}` |
| PUT | `/api/pipelines/:id/stages/reorder` | `{stage_ids: number[]}` | `{ok: true}` |

### Run & Events

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/pipelines/:id/run` | - | `{run_id}` |
| GET | `/api/pipelines/:id/runs` | - | `PipelineRun[]` |
| GET | `/api/runs/:id` | - | `PipelineRunDetail` (status + events) |

## Runtime Loop (PipelineService.run)

```
1. buat run (status=running)
2. for each stage (position asc):
   a. event stage_start
   b. loop attempt = 1..max_iterations:
      - build prompt: instruction + knowledge buffer (semua jawaban/artifacts dari stage sebelumnya + feedback answers)
      - LLM chat → output
      - kalau output mengandung marker NEED_MORE: <question>:
          event need_more
          resolve specialist: cari specialist dengan capability match (name/description contains keyword dari question)
          event resolve → panggil specialist tsb (LLM dengan konteks) → answer
          event answer → append ke buffer → retry stage (attempt+1)
      - kalau tidak ada marker: stage done, output append ke buffer → break
   c. kalau attempts habis: stage_failed → run failed
3. semua stage done → event pipeline_done, run status=done
```

### NEED_MORE marker

LLM diminta output dalam format:

```text
NEED_MORE: <pertanyaan spesifik>
```

Kalau gak ada marker → output dianggap hasil final stage.

### Resolve specialist

Orchestrator cari specialist yang paling relevan untuk menjawab pertanyaan:
1. Ambil semua specialist (kecuali yang lagi jalan di stage ini)
2. Score = keyword match antara pertanyaan dan (name + description + knowledge titles)
3. Specialist dengan score tertinggi dipanggil: LLM dengan pertanyaan + konteks buffer

## Types (domain/types.ts tambahan)

```ts
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

export interface PipelineRunEvent {
  id: number;
  run_id: number;
  stage_position: number | null;
  specialist_id: number | null;
  kind: PipelineEventKind;
  content: string;
  created_at: string;
}

export type PipelineEventKind =
  | "stage_start" | "stage_done" | "need_more" | "resolve"
  | "answer" | "stage_failed" | "pipeline_done" | "pipeline_failed";

export interface PipelineRunDetail extends PipelineRun {
  events: PipelineRunEvent[];
}
```

## Prompt Template (stage execution)

```text
Kamu adalah {specialist.name}: {specialist.description}

TUGAS STAGE: {stage.name}
{stage.instruction}

KONTEKS (knowledge buffer dari stage sebelumnya):
{buffer}

Gunakan knowledge di atas untuk menyelesaikan tugas.
Kalau kamu butuh informasi TAMBAHAN dari specialist lain, akhiri output dengan:
NEED_MORE: <pertanyaan spesifik>
Kalau tidak, jawab langsung dengan hasil final.
```

## Prompt Template (resolve answer)

```text
Kamu adalah {specialist.name}: {specialist.description}

Ada pertanyaan dari pipeline stage lain:
{question}

Konteks pipeline sejauh ini:
{buffer}

Jawab pertanyaan dengan knowledge kamu. Jawaban akan dipakai sebagai input stage lain.
```
