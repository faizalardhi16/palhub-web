# PalHub — Agentic Working Tools

Bangun **specialist** (finance, business analyst, legal, dll) lengkap dengan **tools**, **procedures**, dan **knowledge** — lalu consume tools-nya dari mana aja: web UI, Cursor, Codex, Claude Code, dll.

## Konsep

```
SPECIALIST (misal: Finance)
├── TOOLS → di-expose ke MCP (dipanggil Cursor/Codex/Claude Code)
│   ├── finance_crawl(prompt)          → crawl web → simpan ke Knowledge
│   ├── finance_generate_doc(prompt)   → generate .MD sesuai Procedure
│   └── finance_knowledge_search(q)    → RAG keyword ke Knowledge specialist
├── PROCEDURES → template struktur dokumen (bisa banyak)
└── KNOWLEDGE → hasil crawl / dokumen, di-group per specialist (SQLite FTS5)
```

- **Web UI** (`:5173`) — kelola specialist/tools/procedures + lihat knowledge + playground buat test tool.
- **MCP** (`POST /mcp`) — semua tools specialist otomatis jadi MCP tools dengan nama `<specialist>_<tool>` (contoh: `finance_crawl`).
- **Knowledge** — markdown disimpan per specialist, di-index FTS5, bisa di-retrieve (RAG v1 keyword).

## Stack

- **Backend:** Fastify 5 + TypeScript, SOLID (services + tool executors polymorphism + DI)
- **Database:** SQLite (better-sqlite3) + FTS5
- **Frontend:** Vite + React + TypeScript (dark theme)
- **MCP:** @modelcontextprotocol/sdk — Streamable HTTP transport

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env    # isi LLM_API_KEY (OpenAI-compatible: DeepSeek, NVIDIA NIM, dll)
npm install
npm run dev             # http://localhost:8787
```

### 2. Frontend

```bash
cd web
npm install
npm run dev             # http://localhost:5173 (proxy /api → :8787)
```

Seed otomatis: specialist **Finance** (crawl, generate_doc, knowledge_search) + **Business Analyst** (transform, knowledge_search).

## Integrasi MCP ke Tool Lain

Semua tools specialist otomatis muncul di `POST /mcp` (Streamable HTTP).

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.palhub]
url = "http://localhost:8787/mcp"
```

**Claude Code** / **Cursor** — daftarkan MCP server dengan URL yang sama.

Contoh di Codex:

```
Panggil finance_knowledge_search: "prosedur renew CoA yang benar"
Panggil finance_generate_doc: "buat dokumen prosedur CoA sesuai template"
```

## Tool Types

| Type | Behavior |
|------|----------|
| `crawl` | Input prompt → extract URL dari prompt, atau LLM menyarankan sumber resmi → fetch → simpan ke Knowledge |
| `generate_doc` | Input prompt → LLM generate .MD mengikuti template Procedure → simpan ke `data/documents/` + Knowledge |
| `knowledge_query` | Input query → FTS5 search di Knowledge specialist → return top chunks + sumber |

Tambah tipe baru = buat class executor baru (implement `ToolExecutor`) + register di `server.ts`. Tanpa if-else chain.

## API

```
GET    /api/specialists
POST   /api/specialists
GET    /api/specialists/:id
PUT    /api/specialists/:id
DELETE /api/specialists/:id

GET/POST /api/specialists/:id/tools
PUT/DELETE /api/tools/:id

GET/POST /api/specialists/:id/procedures
PUT/DELETE /api/procedures/:id

GET/POST /api/specialists/:id/knowledge
DELETE /api/knowledge/:id

POST   /api/specialists/:id/playground   { tool_id, input: { prompt } }
POST   /mcp                              (MCP Streamable HTTP)
```

## Struktur

```
backend/
├── src/
│   ├── db/            SQLite connection + schema + seed
│   ├── domain/        types + zod schemas
│   ├── services/      specialist / tool / procedure / knowledge / playground
│   ├── engines/       tool executors (crawl, generate_doc, knowledge_query) + registry
│   ├── llm/           OpenAI-compatible client
│   ├── mcp/           MCP server (Streamable HTTP)
│   └── routes/        REST routes
web/
└── src/
    ├── api/           API client
    ├── components/    Layout
    └── pages/         Specialists, SpecialistDetail, Playground
```

## Roadmap

- [x] Specialist + tools + procedures + knowledge CRUD
- [x] Tool engine: crawl, generate_doc, knowledge_query
- [x] MCP Streamable HTTP (di-consume Cursor/Codex/Claude Code)
- [x] Playground test tool
- [ ] Hindsight: solusi yang pernah digenerate jadi konteks sesi berikutnya
- [ ] Embeddings (RAG v2) kalau recall keyword kurang
- [ ] Shared session lintas interface (diskusi di Codex, lanjut di web)
