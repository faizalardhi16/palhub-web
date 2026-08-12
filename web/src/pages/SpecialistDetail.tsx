import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import {
  ArrowLeftIcon,
  BookIcon,
  BrainIcon,
  GridIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  ToolIcon,
  TrashIcon,
} from "../components/Icons";
import type { Knowledge, Procedure, Tool } from "../types";

type Tab = "tools" | "procedures" | "knowledge";

const TOOL_TYPE_LABELS: Record<Tool["type"], string> = {
  crawl: "Crawl",
  generate_doc: "Generate Doc",
  knowledge_query: "Knowledge Query",
};

const EMPTY_TOOL = { name: "", description: "", type: "knowledge_query" as Tool["type"], procedure_id: null as number | null };
const EMPTY_PROCEDURE = { name: "", description: "", template: "" };
const EMPTY_KNOWLEDGE = { title: "", content: "", source: "" };

function formatDate(value: string) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function SpecialistDetail() {
  const { id } = useParams();
  const specialistId = Number(id);

  const [tab, setTab] = useState<Tab>("tools");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [tools, setTools] = useState<Tool[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);

  const [toolForm, setToolForm] = useState(EMPTY_TOOL);
  const [procedureForm, setProcedureForm] = useState(EMPTY_PROCEDURE);
  const [knowledgeForm, setKnowledgeForm] = useState(EMPTY_KNOWLEDGE);
  const [error, setError] = useState("");

  const specialistSlug = useMemo(() => {
    const normalized = name.trim().toLowerCase().replace(/\s+/g, "_");
    return normalized || "specialist";
  }, [name]);

  const load = useCallback(async () => {
    try {
      const [spec, ts, ps, ks] = await Promise.all([
        api.listSpecialists(),
        api.listTools(specialistId),
        api.listProcedures(specialistId),
        api.listKnowledge(specialistId),
      ]);
      const found = spec.find((item) => item.id === specialistId);
      if (found) {
        setName(found.name);
        setDescription(found.description);
      }
      setTools(ts);
      setProcedures(ps);
      setKnowledge(ks);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [specialistId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createTool = async () => {
    try {
      await api.createTool(specialistId, {
        ...toolForm,
        procedure_id: toolForm.procedure_id || null,
      });
      setToolForm(EMPTY_TOOL);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createProcedure = async () => {
    try {
      await api.createProcedure(specialistId, procedureForm);
      setProcedureForm(EMPTY_PROCEDURE);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createKnowledge = async () => {
    try {
      await api.createKnowledge(specialistId, knowledgeForm);
      setKnowledgeForm(EMPTY_KNOWLEDGE);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="page-stack">
      <Link to="/" className="back-link">
        <ArrowLeftIcon className="icon" />
        <span>Semua specialists</span>
      </Link>

      <section className="hero-section compact-hero">
        <div className="hero-copy">
          <span className="eyebrow">Specialist Workbench</span>
          <h2 className="hero-title">{name || "Loading specialist..."}</h2>
          <p className="hero-text">{description || "Atur tools, procedures, dan knowledge dari satu workbench yang lebih fokus dan operasional."}</p>
          <div className="hero-actions">
            <Link to={`/playground/${specialistId}`}>
              <button className="primary accent-violet">
                <PlayIcon className="icon" />
                <span>Buka Playground</span>
              </button>
            </Link>
            <button
              className="danger"
              onClick={async () => {
                if (window.confirm(`Hapus specialist \"${name}\" beserta semua tools, procedures, dan knowledge?`)) {
                  await api.deleteSpecialist(specialistId);
                  window.location.href = "/";
                }
              }}
            >
              <TrashIcon className="icon" />
              <span>Hapus specialist</span>
            </button>
          </div>
        </div>

        <div className="hero-grid hero-grid-3">
          <div className="metric-card">
            <span className="metric-label">Tool coverage</span>
            <strong>{tools.length}</strong>
            <p>Executable entry points for MCP and UI.</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">Procedure library</span>
            <strong>{procedures.length}</strong>
            <p>Reusable output structure and workflow templates.</p>
          </div>
          <div className="metric-card metric-card-accent">
            <span className="metric-label">Knowledge base</span>
            <strong>{knowledge.length}</strong>
            <p>Stored context that keeps specialist answers anchored.</p>
          </div>
        </div>
      </section>

      {error && <div className="err-box">{error}</div>}

      <div className="mode-tabs">
        {(
          [
            ["tools", `Tools (${tools.length})`, ToolIcon],
            ["procedures", `Procedures (${procedures.length})`, BookIcon],
            ["knowledge", `Knowledge (${knowledge.length})`, BrainIcon],
          ] as [Tab, string, typeof ToolIcon][]
        ).map(([key, label, Icon]) => (
          <button key={key} className={`mode-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            <Icon className="icon" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {tab === "tools" && (
        <section className="split-section detail-split">
          <div className="surface-card form-panel">
            <div className="section-heading-row">
              <div>
                <span className="eyebrow">Builder</span>
                <h3>Tambah tool</h3>
              </div>
              <div className="section-chip">
                <ToolIcon className="icon" />
                <span>MCP alias: {specialistSlug}_name</span>
              </div>
            </div>

            <div className="field-grid">
              <div className="field">
                <label>Nama tool</label>
                <input
                  value={toolForm.name}
                  onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })}
                  placeholder="generate_doc"
                />
              </div>
              <div className="field">
                <label>Tipe</label>
                <select value={toolForm.type} onChange={(e) => setToolForm({ ...toolForm, type: e.target.value as Tool["type"] })}>
                  {(Object.keys(TOOL_TYPE_LABELS) as Tool["type"][]).map((type) => (
                    <option key={type} value={type}>
                      {TOOL_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field field-span-2">
                <label>Deskripsi</label>
                <input
                  value={toolForm.description}
                  onChange={(e) => setToolForm({ ...toolForm, description: e.target.value })}
                  placeholder="Tool ini menjalankan knowledge lookup atau dokumen generation dengan perilaku yang jelas."
                />
              </div>
              {toolForm.type === "generate_doc" && (
                <div className="field field-span-2">
                  <label>Procedure terkait</label>
                  <select
                    value={toolForm.procedure_id ?? ""}
                    onChange={(e) => setToolForm({ ...toolForm, procedure_id: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">Tanpa procedure</option>
                    {procedures.map((procedure) => (
                      <option key={procedure.id} value={procedure.id}>
                        {procedure.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button className="primary" onClick={createTool} disabled={!toolForm.name.trim()}>
              <PlusIcon className="icon" />
              <span>Simpan tool</span>
            </button>
          </div>

          <div className="surface-card list-panel">
            <div className="section-heading-row">
              <div>
                <span className="eyebrow">Inventory</span>
                <h3>Tool registry</h3>
              </div>
              <div className="section-chip">
                <GridIcon className="icon" />
                <span>Ready for UI and MCP</span>
              </div>
            </div>

            {tools.length === 0 ? (
              <div className="empty-state compact-empty">
                <ToolIcon className="icon" />
                <div>
                  <strong>Belum ada tool.</strong>
                  <p>Tambahkan tool pertama untuk mulai expose capability specialist ini.</p>
                </div>
              </div>
            ) : (
              <div className="entity-list">
                {tools.map((tool) => (
                  <article className="entity-card" key={tool.id}>
                    <div className="entity-main">
                      <div className="entity-header">
                        <div>
                          <h4>{tool.name}</h4>
                          <p>{tool.description || "Tanpa deskripsi tool."}</p>
                        </div>
                        <span className="metric-pill">{TOOL_TYPE_LABELS[tool.type]}</span>
                      </div>
                      <div className="entity-meta-row">
                        <span className="meta-pill">MCP: {specialistSlug}_{tool.name}</span>
                        <span className="meta-pill">Procedure: {procedures.find((item) => item.id === tool.procedure_id)?.name ?? "none"}</span>
                        <span className="meta-pill">Created: {formatDate(tool.created_at)}</span>
                      </div>
                    </div>
                    <button
                      className="danger ghost-danger"
                      onClick={async () => {
                        await api.deleteTool(tool.id);
                        await load();
                      }}
                    >
                      <TrashIcon className="icon" />
                      <span>Hapus</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "procedures" && (
        <section className="split-section detail-split">
          <div className="surface-card form-panel">
            <div className="section-heading-row">
              <div>
                <span className="eyebrow">Blueprint</span>
                <h3>Tambah procedure</h3>
              </div>
              <div className="section-chip">
                <BookIcon className="icon" />
                <span>Template-driven output</span>
              </div>
            </div>

            <div className="field-grid">
              <div className="field">
                <label>Nama procedure</label>
                <input
                  value={procedureForm.name}
                  onChange={(e) => setProcedureForm({ ...procedureForm, name: e.target.value })}
                  placeholder="Generate Document"
                />
              </div>
              <div className="field">
                <label>Deskripsi</label>
                <input value={procedureForm.description} onChange={(e) => setProcedureForm({ ...procedureForm, description: e.target.value })} />
              </div>
              <div className="field field-span-2">
                <label>Template markdown</label>
                <textarea
                  className="mono"
                  rows={10}
                  value={procedureForm.template}
                  onChange={(e) => setProcedureForm({ ...procedureForm, template: e.target.value })}
                  placeholder={"# {Judul Dokumen}\n\n## Definisi\n...\n\n## Prosedur\n..."}
                />
              </div>
            </div>

            <button className="primary" onClick={createProcedure} disabled={!procedureForm.name.trim() || !procedureForm.template.trim()}>
              <PlusIcon className="icon" />
              <span>Simpan procedure</span>
            </button>
          </div>

          <div className="surface-card list-panel">
            <div className="section-heading-row">
              <div>
                <span className="eyebrow">Library</span>
                <h3>Procedure collection</h3>
              </div>
              <div className="section-chip">
                <BookIcon className="icon" />
                <span>Reusable formatting rules</span>
              </div>
            </div>

            {procedures.length === 0 ? (
              <div className="empty-state compact-empty">
                <BookIcon className="icon" />
                <div>
                  <strong>Belum ada procedure.</strong>
                  <p>Tambahkan struktur dokumen agar tool generation punya output contract yang konsisten.</p>
                </div>
              </div>
            ) : (
              <div className="entity-list">
                {procedures.map((procedure) => (
                  <article className="entity-card" key={procedure.id}>
                    <div className="entity-main">
                      <div className="entity-header">
                        <div>
                          <h4>{procedure.name}</h4>
                          <p>{procedure.description || "Tanpa deskripsi procedure."}</p>
                        </div>
                        <span className="metric-pill">{procedure.template.length} chars</span>
                      </div>
                      <div className="entity-meta-row">
                        <span className="meta-pill">Created: {formatDate(procedure.created_at)}</span>
                      </div>
                    </div>
                    <button
                      className="danger ghost-danger"
                      onClick={async () => {
                        await api.deleteProcedure(procedure.id);
                        await load();
                      }}
                    >
                      <TrashIcon className="icon" />
                      <span>Hapus</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "knowledge" && (
        <section className="split-section detail-split">
          <div className="surface-card form-panel">
            <div className="section-heading-row">
              <div>
                <span className="eyebrow">Knowledge Intake</span>
                <h3>Tambah knowledge manual</h3>
              </div>
              <div className="section-chip">
                <SearchIcon className="icon" />
                <span>RAG-ready content source</span>
              </div>
            </div>

            <div className="field-grid">
              <div className="field">
                <label>Judul</label>
                <input value={knowledgeForm.title} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })} placeholder="CoA Pendaftaran" />
              </div>
              <div className="field">
                <label>Sumber</label>
                <input value={knowledgeForm.source} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, source: e.target.value })} placeholder="https://..." />
              </div>
              <div className="field field-span-2">
                <label>Konten</label>
                <textarea className="mono" rows={8} value={knowledgeForm.content} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })} />
              </div>
            </div>

            <button className="primary" onClick={createKnowledge} disabled={!knowledgeForm.title.trim() || !knowledgeForm.content.trim()}>
              <PlusIcon className="icon" />
              <span>Simpan knowledge</span>
            </button>
          </div>

          <div className="surface-card list-panel">
            <div className="section-heading-row">
              <div>
                <span className="eyebrow">Stored Context</span>
                <h3>Knowledge entries</h3>
              </div>
              <div className="section-chip">
                <BrainIcon className="icon" />
                <span>Specialist-scoped retrieval</span>
              </div>
            </div>

            {knowledge.length === 0 ? (
              <div className="empty-state compact-empty">
                <BrainIcon className="icon" />
                <div>
                  <strong>Belum ada knowledge.</strong>
                  <p>Jalankan crawl atau tambahkan pengetahuan manual agar specialist ini punya context yang hidup.</p>
                </div>
              </div>
            ) : (
              <div className="entity-list">
                {knowledge.map((item) => (
                  <article className="entity-card" key={item.id}>
                    <div className="entity-main">
                      <div className="entity-header">
                        <div>
                          <h4>{item.title}</h4>
                          <p>{item.content.slice(0, 220)}{item.content.length > 220 ? "..." : ""}</p>
                        </div>
                      </div>
                      <div className="entity-meta-row">
                        <span className="meta-pill">Source: {item.source || "manual entry"}</span>
                        <span className="meta-pill">Created: {formatDate(item.created_at)}</span>
                      </div>
                    </div>
                    <button
                      className="danger ghost-danger"
                      onClick={async () => {
                        await api.deleteKnowledge(item.id);
                        await load();
                      }}
                    >
                      <TrashIcon className="icon" />
                      <span>Hapus</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
