import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Blocks,
  FileSearch,
  FileText,
  FlaskConical,
  Layers3,
  Orbit,
  Plus,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
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

const tabConfig: Array<{ key: Tab; label: string; icon: typeof Wrench }> = [
  { key: "tools", label: "Tools", icon: Wrench },
  { key: "procedures", label: "Procedures", icon: FileText },
  { key: "knowledge", label: "Knowledge", icon: Layers3 },
];

function formatDate(value: string) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function SectionHeader({
  eyebrow,
  title,
  chip,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  chip: string;
  icon: typeof Wrench;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h3 className="section-title mt-2">{title}</h3>
      </div>
      <div className="metric-chip">
        <Icon className="h-4 w-4" />
        <span>{chip}</span>
      </div>
    </div>
  );
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
      await api.createTool(specialistId, { ...toolForm, procedure_id: toolForm.procedure_id || null });
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
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" />
        <span>Semua specialists</span>
      </Link>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="hero-shell grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]"
      >
        <div>
          <span className="eyebrow">Specialist Workbench</span>
          <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-[-0.07em] text-slate-950 lg:text-[3rem]">
            {name || "Loading specialist..."}
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600 lg:text-base">
            {description || "Atur tools, procedures, dan stored context dari satu workbench yang lebih fokus dan operasional."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={`/playground/${specialistId}`} className="action-secondary !border-violet-200 !bg-violet-50 !text-violet-700">
              <FlaskConical className="h-4 w-4" />
              <span>Buka Playground</span>
            </Link>
            <button
              className="action-danger"
              onClick={async () => {
                if (window.confirm(`Hapus specialist \"${name}\" beserta semua tools, procedures, dan knowledge?`)) {
                  await api.deleteSpecialist(specialistId);
                  window.location.href = "/";
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span>Hapus specialist</span>
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-3">
          <div className="panel-surface-strong p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Tool coverage</div>
            <div className="mt-3 font-display text-5xl font-bold tracking-[-0.08em] text-slate-950">{tools.length}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Executable entry points for UI and MCP.</p>
          </div>
          <div className="panel-surface-strong p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Procedure library</div>
            <div className="mt-3 font-display text-5xl font-bold tracking-[-0.08em] text-slate-950">{procedures.length}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Reusable templates and output structure.</p>
          </div>
          <div className="panel-surface-strong bg-gradient-to-br from-sky-50 to-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Stored context</div>
            <div className="mt-3 font-display text-5xl font-bold tracking-[-0.08em] text-slate-950">{knowledge.length}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Context that keeps specialist output anchored.</p>
          </div>
        </div>
      </motion.section>

      {error && <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>}

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.06 }} className="flex flex-wrap gap-3">
        {tabConfig.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              tab === key
                ? "border-brand-200 bg-brand-50 text-brand-700 shadow-[0_14px_30px_rgba(15,23,42,0.06)]"
                : "border-slate-200 bg-white/85 text-slate-600 hover:border-slate-300"
            }`}
            onClick={() => setTab(key)}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-slate-500">
              {key === "tools" ? tools.length : key === "procedures" ? procedures.length : knowledge.length}
            </span>
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {tab === "tools" && (
          <motion.section
            key="tools"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]"
          >
            <div className="panel-surface space-y-6 p-6">
              <SectionHeader eyebrow="Builder" title="Tambah tool" chip={`MCP alias: ${specialistSlug}_name`} icon={Wrench} />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <label className="grid gap-2">
                  <span className="field-label">Nama tool</span>
                  <input className="input-shell" value={toolForm.name} onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })} placeholder="generate_doc" />
                </label>
                <label className="grid gap-2">
                  <span className="field-label">Tipe</span>
                  <select className="input-shell" value={toolForm.type} onChange={(e) => setToolForm({ ...toolForm, type: e.target.value as Tool["type"] })}>
                    {(Object.keys(TOOL_TYPE_LABELS) as Tool["type"][]).map((type) => (
                      <option key={type} value={type}>{TOOL_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 md:col-span-2 xl:col-span-1">
                  <span className="field-label">Deskripsi</span>
                  <input className="input-shell" value={toolForm.description} onChange={(e) => setToolForm({ ...toolForm, description: e.target.value })} placeholder="Tool ini menjalankan retrieval, crawling, atau document generation dengan perilaku yang jelas." />
                </label>
                {toolForm.type === "generate_doc" && (
                  <label className="grid gap-2 md:col-span-2 xl:col-span-1">
                    <span className="field-label">Procedure terkait</span>
                    <select className="input-shell" value={toolForm.procedure_id ?? ""} onChange={(e) => setToolForm({ ...toolForm, procedure_id: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">Tanpa procedure</option>
                      {procedures.map((procedure) => (
                        <option key={procedure.id} value={procedure.id}>{procedure.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <button className="action-primary" onClick={createTool} disabled={!toolForm.name.trim()}>
                <Plus className="h-4 w-4" />
                <span>Simpan tool</span>
              </button>
            </div>

            <div className="panel-surface p-6">
              <SectionHeader eyebrow="Inventory" title="Tool registry" chip="Ready for UI and MCP" icon={Blocks} />
              <div className="mt-6 space-y-4">
                {tools.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600">
                    Belum ada tool. Tambahkan tool pertama untuk mulai expose capability specialist ini.
                  </div>
                ) : (
                  tools.map((tool) => (
                    <motion.article key={tool.id} layout className="panel-surface-strong flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-start gap-3">
                          <div>
                            <h4 className="font-display text-xl font-bold tracking-[-0.04em] text-slate-950">{tool.name}</h4>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{tool.description || "Tanpa deskripsi tool."}</p>
                          </div>
                          <span className="metric-chip">{TOOL_TYPE_LABELS[tool.type]}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="metric-chip">MCP: {specialistSlug}_{tool.name}</span>
                          <span className="metric-chip">Procedure: {procedures.find((item) => item.id === tool.procedure_id)?.name ?? "none"}</span>
                          <span className="metric-chip">Created: {formatDate(tool.created_at)}</span>
                        </div>
                      </div>
                      <button className="action-danger" onClick={async () => { await api.deleteTool(tool.id); await load(); }}>
                        <Trash2 className="h-4 w-4" />
                        <span>Hapus</span>
                      </button>
                    </motion.article>
                  ))
                )}
              </div>
            </div>
          </motion.section>
        )}

        {tab === "procedures" && (
          <motion.section
            key="procedures"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]"
          >
            <div className="panel-surface space-y-6 p-6">
              <SectionHeader eyebrow="Blueprint" title="Tambah procedure" chip="Template-driven output" icon={FileText} />
              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="field-label">Nama procedure</span>
                  <input className="input-shell" value={procedureForm.name} onChange={(e) => setProcedureForm({ ...procedureForm, name: e.target.value })} placeholder="Generate Document" />
                </label>
                <label className="grid gap-2">
                  <span className="field-label">Deskripsi</span>
                  <input className="input-shell" value={procedureForm.description} onChange={(e) => setProcedureForm({ ...procedureForm, description: e.target.value })} />
                </label>
                <label className="grid gap-2">
                  <span className="field-label">Template markdown</span>
                  <textarea className="input-shell min-h-64 font-mono text-sm" value={procedureForm.template} onChange={(e) => setProcedureForm({ ...procedureForm, template: e.target.value })} placeholder={"# {Judul Dokumen}\n\n## Definisi\n...\n\n## Prosedur\n..."} />
                </label>
              </div>
              <button className="action-primary" onClick={createProcedure} disabled={!procedureForm.name.trim() || !procedureForm.template.trim()}>
                <Plus className="h-4 w-4" />
                <span>Simpan procedure</span>
              </button>
            </div>

            <div className="panel-surface p-6">
              <SectionHeader eyebrow="Library" title="Procedure collection" chip="Reusable formatting rules" icon={FileSearch} />
              <div className="mt-6 space-y-4">
                {procedures.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600">
                    Belum ada procedure. Tambahkan struktur dokumen agar output tool punya contract yang konsisten.
                  </div>
                ) : (
                  procedures.map((procedure) => (
                    <motion.article key={procedure.id} layout className="panel-surface-strong flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-3">
                        <div>
                          <h4 className="font-display text-xl font-bold tracking-[-0.04em] text-slate-950">{procedure.name}</h4>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{procedure.description || "Tanpa deskripsi procedure."}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="metric-chip">{procedure.template.length} chars</span>
                          <span className="metric-chip">Created: {formatDate(procedure.created_at)}</span>
                        </div>
                      </div>
                      <button className="action-danger" onClick={async () => { await api.deleteProcedure(procedure.id); await load(); }}>
                        <Trash2 className="h-4 w-4" />
                        <span>Hapus</span>
                      </button>
                    </motion.article>
                  ))
                )}
              </div>
            </div>
          </motion.section>
        )}

        {tab === "knowledge" && (
          <motion.section
            key="knowledge"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]"
          >
            <div className="panel-surface space-y-6 p-6">
              <SectionHeader eyebrow="Knowledge Intake" title="Tambah knowledge manual" chip="Retrieval-ready source" icon={Search} />
              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="field-label">Judul</span>
                  <input className="input-shell" value={knowledgeForm.title} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })} placeholder="CoA Pendaftaran" />
                </label>
                <label className="grid gap-2">
                  <span className="field-label">Sumber</span>
                  <input className="input-shell" value={knowledgeForm.source} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, source: e.target.value })} placeholder="https://..." />
                </label>
                <label className="grid gap-2">
                  <span className="field-label">Konten</span>
                  <textarea className="input-shell min-h-56 font-mono text-sm" value={knowledgeForm.content} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })} />
                </label>
              </div>
              <button className="action-primary" onClick={createKnowledge} disabled={!knowledgeForm.title.trim() || !knowledgeForm.content.trim()}>
                <Plus className="h-4 w-4" />
                <span>Simpan knowledge</span>
              </button>
            </div>

            <div className="panel-surface p-6">
              <SectionHeader eyebrow="Stored Context" title="Knowledge entries" chip="Specialist-scoped retrieval" icon={Orbit} />
              <div className="mt-6 space-y-4">
                {knowledge.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600">
                    Belum ada knowledge. Jalankan crawl atau tambahkan pengetahuan manual agar specialist ini punya context yang hidup.
                  </div>
                ) : (
                  knowledge.map((item) => (
                    <motion.article key={item.id} layout className="panel-surface-strong flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-3">
                        <div>
                          <h4 className="font-display text-xl font-bold tracking-[-0.04em] text-slate-950">{item.title}</h4>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.content.slice(0, 220)}{item.content.length > 220 ? "..." : ""}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="metric-chip">Source: {item.source || "manual entry"}</span>
                          <span className="metric-chip">Created: {formatDate(item.created_at)}</span>
                        </div>
                      </div>
                      <button className="action-danger" onClick={async () => { await api.deleteKnowledge(item.id); await load(); }}>
                        <Trash2 className="h-4 w-4" />
                        <span>Hapus</span>
                      </button>
                    </motion.article>
                  ))
                )}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
