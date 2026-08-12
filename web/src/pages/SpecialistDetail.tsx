import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Knowledge, Procedure, Tool } from "../types";

type Tab = "tools" | "procedures" | "knowledge";

const TOOL_TYPE_LABELS: Record<Tool["type"], string> = {
  crawl: "🕷️ Crawl",
  generate_doc: "📄 Generate Doc",
  knowledge_query: "🔍 Knowledge Query",
};

const EMPTY_TOOL = { name: "", description: "", type: "knowledge_query" as Tool["type"], procedure_id: null as number | null };
const EMPTY_PROCEDURE = { name: "", description: "", template: "" };
const EMPTY_KNOWLEDGE = { title: "", content: "", source: "" };

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

  const load = useCallback(async () => {
    try {
      const [spec, ts, ps, ks] = await Promise.all([
        api.listSpecialists(),
        api.listTools(specialistId),
        api.listProcedures(specialistId),
        api.listKnowledge(specialistId),
      ]);
      const found = spec.find((s) => s.id === specialistId);
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
    <div>
      <Link to="/" className="back-link">
        ← Semua specialists
      </Link>
      <h1>{name}</h1>
      <p className="sub">{description}</p>

      <div className="row" style={{ marginBottom: 16 }}>
        <Link to={`/playground/${specialistId}`}>
          <button className="primary">▶ Buka Playground</button>
        </Link>
        <button
          className="danger"
          onClick={async () => {
            if (confirm(`Hapus specialist "${name}" beserta semua tools/procedures/knowledge?`)) {
              await api.deleteSpecialist(specialistId);
              location.href = "/";
            }
          }}
        >
          Hapus
        </button>
      </div>

      {error && <div className="err-box">{error}</div>}

      <div className="tabs">
        {(
          [
            ["tools", `🛠️ Tools (${tools.length})`],
            ["procedures", `📋 Procedures (${procedures.length})`],
            ["knowledge", `🧠 Knowledge (${knowledge.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "tools" && (
        <div>
          <div className="panel">
            <h2>➕ Tool baru</h2>
            <div className="field">
              <label>Nama (MCP: {name.toLowerCase().replace(/\s+/g, "_")}_&lt;nama&gt;)</label>
              <input
                value={toolForm.name}
                onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })}
                placeholder="generate_doc"
              />
            </div>
            <div className="field">
              <label>Deskripsi</label>
              <input
                value={toolForm.description}
                onChange={(e) => setToolForm({ ...toolForm, description: e.target.value })}
                placeholder="Generate dokumen .MD sesuai procedure..."
              />
            </div>
            <div className="field">
              <label>Tipe</label>
              <select
                value={toolForm.type}
                onChange={(e) => setToolForm({ ...toolForm, type: e.target.value as Tool["type"] })}
              >
                {(Object.keys(TOOL_TYPE_LABELS) as Tool["type"][]).map((t) => (
                  <option key={t} value={t}>
                    {TOOL_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            {toolForm.type === "generate_doc" && (
              <div className="field">
                <label>Procedure</label>
                <select
                  value={toolForm.procedure_id ?? ""}
                  onChange={(e) =>
                    setToolForm({ ...toolForm, procedure_id: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  <option value="">— tanpa procedure —</option>
                  {procedures.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button className="primary" onClick={createTool} disabled={!toolForm.name.trim()}>
              Simpan Tool
            </button>
          </div>

          {tools.length === 0 ? (
            <div className="empty">Belum ada tool.</div>
          ) : (
            tools.map((t) => (
              <div className="list-item" key={t.id}>
                <div>
                  <h4>
                    {TOOL_TYPE_LABELS[t.type]} <code>{name.toLowerCase().replace(/\s+/g, "_")}_{t.name}</code>
                  </h4>
                  <p>{t.description}</p>
                  <div className="meta">
                    procedure: {procedures.find((p) => p.id === t.procedure_id)?.name ?? "—"}
                  </div>
                </div>
                <button
                  className="danger"
                  onClick={async () => {
                    await api.deleteTool(t.id);
                    await load();
                  }}
                >
                  Hapus
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "procedures" && (
        <div>
          <div className="panel">
            <h2>➕ Procedure baru</h2>
            <div className="field">
              <label>Nama</label>
              <input
                value={procedureForm.name}
                onChange={(e) => setProcedureForm({ ...procedureForm, name: e.target.value })}
                placeholder="Generate Document"
              />
            </div>
            <div className="field">
              <label>Deskripsi</label>
              <input
                value={procedureForm.description}
                onChange={(e) => setProcedureForm({ ...procedureForm, description: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Template struktur dokumen (markdown)</label>
              <textarea
                className="mono"
                rows={8}
                value={procedureForm.template}
                onChange={(e) => setProcedureForm({ ...procedureForm, template: e.target.value })}
                placeholder={"# {Judul Dokumen}\n\n## Definisi\n...\n\n## Prosedur\n..."}
              />
            </div>
            <button className="primary" onClick={createProcedure} disabled={!procedureForm.name.trim() || !procedureForm.template.trim()}>
              Simpan Procedure
            </button>
          </div>

          {procedures.length === 0 ? (
            <div className="empty">Belum ada procedure.</div>
          ) : (
            procedures.map((p) => (
              <div className="list-item" key={p.id}>
                <div>
                  <h4>{p.name}</h4>
                  <p>{p.description}</p>
                  <div className="meta">template: {p.template.length} chars</div>
                </div>
                <button
                  className="danger"
                  onClick={async () => {
                    await api.deleteProcedure(p.id);
                    await load();
                  }}
                >
                  Hapus
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "knowledge" && (
        <div>
          <div className="panel">
            <h2>➕ Tambah knowledge manual</h2>
            <div className="field">
              <label>Judul</label>
              <input
                value={knowledgeForm.title}
                onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                placeholder="CoA Pendaftaran"
              />
            </div>
            <div className="field">
              <label>Konten</label>
              <textarea
                className="mono"
                rows={4}
                value={knowledgeForm.content}
                onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Sumber (URL / origin)</label>
              <input
                value={knowledgeForm.source}
                onChange={(e) => setKnowledgeForm({ ...knowledgeForm, source: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <button className="primary" onClick={createKnowledge} disabled={!knowledgeForm.title.trim() || !knowledgeForm.content.trim()}>
              Simpan Knowledge
            </button>
          </div>

          {knowledge.length === 0 ? (
            <div className="empty">Belum ada knowledge. Jalankan tool crawl atau tambah manual.</div>
          ) : (
            knowledge.map((k) => (
              <div className="list-item" key={k.id}>
                <div>
                  <h4>{k.title}</h4>
                  <p>{k.content.slice(0, 220)}{k.content.length > 220 ? "..." : ""}</p>
                  <div className="meta">
                    {k.source || "tanpa sumber"} · {k.created_at}
                  </div>
                </div>
                <button
                  className="danger"
                  onClick={async () => {
                    await api.deleteKnowledge(k.id);
                    await load();
                  }}
                >
                  Hapus
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
