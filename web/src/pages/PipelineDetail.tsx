import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  HelpCircle,
  Lightbulb,
  Link2,
  Loader2,
  MessageSquare,
  PartyPopper,
  Play,
  Plus,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../api/client";
import type { PipelineDetail, PipelineRunDetail, PipelineStage, SkillExport, Specialist } from "../types";

const EVENT_LABEL: Record<string, { icon: LucideIcon; cls: string; label: string }> = {
  stage_start: { icon: Play, cls: "text-slate-700 bg-slate-100", label: "Stage mulai" },
  stage_done: { icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50", label: "Stage selesai" },
  need_more: { icon: HelpCircle, cls: "text-amber-700 bg-amber-50", label: "Butuh info" },
  resolve: { icon: Link2, cls: "text-violet-700 bg-violet-50", label: "Resolve specialist" },
  answer: { icon: MessageSquare, cls: "text-sky-700 bg-sky-50", label: "Jawaban specialist" },
  stage_failed: { icon: AlertTriangle, cls: "text-rose-700 bg-rose-50", label: "Stage gagal" },
  pipeline_done: { icon: PartyPopper, cls: "text-emerald-700 bg-emerald-50", label: "Pipeline selesai" },
  pipeline_failed: { icon: XCircle, cls: "text-rose-700 bg-rose-50", label: "Pipeline gagal" },
};

export default function PipelineDetail() {
  const { id } = useParams<{ id: string }>();
  const pipelineId = Number(id);
  const navigate = useNavigate();

  const [pipeline, setPipeline] = useState<PipelineDetail | null>(null);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [activeRun, setActiveRun] = useState<PipelineRunDetail | null>(null);
  const [runs, setRuns] = useState<PipelineRunDetail["status"] extends never ? never : import("../types").PipelineRun[]>([]);
  // skill export
  const [exporting, setExporting] = useState(false);
  const [exportData, setExportData] = useState<SkillExport | null>(null);

  // form stage baru
  const [stageSpecialist, setStageSpecialist] = useState("");
  const [stageName, setStageName] = useState("");
  const [stageInstruction, setStageInstruction] = useState("");
  const [stageMaxIter, setStageMaxIter] = useState(3);

  const eventsEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [p, sp] = await Promise.all([api.getPipeline(pipelineId), api.listSpecialists()]);
      setPipeline(p);
      setSpecialists(sp);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  const loadRuns = useCallback(async () => {
    try {
      setRuns(await api.listRuns(pipelineId));
    } catch {
      /* non-fatal */
    }
  }, [pipelineId]);

  useEffect(() => {
    void load();
    void loadRuns();
  }, [load, loadRuns]);

  // polling saat running
  useEffect(() => {
    if (running && activeRun) {
      pollRef.current = setInterval(async () => {
        try {
          const r = await api.getRun(activeRun.id);
          setActiveRun(r);
          if (r.status !== "running") {
            setRunning(false);
            if (pollRef.current) clearInterval(pollRef.current);
            void loadRuns();
          }
        } catch {
          /* ignore */
        }
      }, 1500);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [running, activeRun?.id, loadRuns]);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeRun?.events.length]);

  const addStage = async () => {
    if (!stageSpecialist || !stageName.trim()) return;
    try {
      await api.addStage(pipelineId, {
        specialist_id: Number(stageSpecialist),
        name: stageName.trim(),
        instruction: stageInstruction.trim(),
        max_iterations: stageMaxIter,
      });
      setStageName("");
      setStageInstruction("");
      setError("");
      void load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeStage = async (stageId: number) => {
    if (!confirm("Hapus stage ini?")) return;
    try {
      await api.deleteStage(stageId);
      void load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const moveStage = async (index: number, dir: -1 | 1) => {
    if (!pipeline) return;
    const stages = [...pipeline.stages];
    const j = index + dir;
    if (j < 0 || j >= stages.length) return;
    [stages[index], stages[j]] = [stages[j], stages[index]];
    try {
      await api.reorderStages(pipelineId, stages.map((s) => s.id));
      void load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const run = async () => {
    if (!pipeline) return;
    try {
      setError("");
      setRunning(true);
      const r = await api.runPipeline(pipelineId);
      setActiveRun(r);
      void loadRuns();
    } catch (e) {
      setError((e as Error).message);
      setRunning(false);
    }
  };

  const exportSkill = async () => {
    if (!pipeline) return;
    try {
      setError("");
      setExporting(true);
      const exp = await api.exportPipelineSkill(pipelineId);
      setExportData(exp);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const specialistName = (id: number) => specialists.find((s) => s.id === id)?.name ?? `#${id}`;

  if (loading) return <main className="page-shell"><div className="mt-8 text-center text-slate-500">Loading...</div></main>;

  if (!pipeline) return <main className="page-shell"><div className="notice mt-4">{error || "Pipeline gak ditemukan"}</div></main>;

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-4 pb-0 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700" onClick={() => navigate("/pipelines")}>
            <ArrowLeft className="h-4 w-4" /> Pipelines
          </button>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.05em] text-slate-950">{pipeline.name}</h1>
          {pipeline.description && <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate-600">{pipeline.description}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button className="action-secondary inline-flex items-center justify-center gap-1.5" disabled={exporting} onClick={exportSkill}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "Exporting..." : "Export Skill"}
          </button>
          <button className="action-primary inline-flex items-center justify-center gap-1.5" disabled={running || pipeline.stages.length === 0} onClick={run}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Running..." : "Run Pipeline"}
          </button>
        </div>
      </header>

      {error && <div className="notice mt-4 !text-rose-700 !border-rose-200 !bg-rose-50">{error}</div>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        {/* Kolom kiri: stages */}
        <section className="panel-surface p-6">
          <h2 className="font-display text-xl font-bold text-slate-950">Stages</h2>
          <p className="mt-1 text-sm text-slate-500">
            Stage dieksekusi dari atas ke bawah. Output stage jadi input stage berikutnya.
          </p>

          {pipeline.stages.length === 0 ? (
            <div className="empty mt-4">Belum ada stage — tambah di bawah.</div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {pipeline.stages.map((s, i) => (
                <div key={s.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-3">
                    <span className="metric-chip shrink-0">#{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{s.name}</p>
                      <p className="truncate text-xs text-slate-500">{specialistName(s.specialist_id)} · max {s.max_iterations} iterasi</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button className="btn small" disabled={i === 0} onClick={() => moveStage(i, -1)}><ChevronUp className="h-3.5 w-3.5" /></button>
                      <button className="btn small" disabled={i === pipeline.stages.length - 1} onClick={() => moveStage(i, 1)}><ChevronDown className="h-3.5 w-3.5" /></button>
                      <button className="btn small danger" onClick={() => removeStage(s.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  {s.instruction && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{s.instruction}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4">
            <h3 className="text-sm font-bold text-slate-800">Tambah Stage</h3>
            <div className="mt-3 flex flex-col gap-2">
              <select className="input-shell" value={stageSpecialist} onChange={(e) => setStageSpecialist(e.target.value)}>
                <option value="">— Pilih specialist —</option>
                {specialists.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input
                className="input-shell"
                placeholder="Nama stage (misal: Share knowledge pajak)"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
              />
              <textarea
                className="input-shell min-h-20"
                placeholder="Instruksi — apa yang specialist lakukan di stage ini"
                value={stageInstruction}
                onChange={(e) => setStageInstruction(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600">Max iterasi feedback:</label>
                <select className="input-shell w-24 !py-2" value={stageMaxIter} onChange={(e) => setStageMaxIter(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button className="action-secondary inline-flex items-center gap-1.5 self-start" disabled={!stageSpecialist || !stageName.trim()} onClick={addStage}>
                <Plus className="h-4 w-4" /> Tambah Stage
              </button>
            </div>
          </div>
        </section>

        {/* Kolom kanan: run live + history */}
        <section className="panel-surface p-6">
          <h2 className="font-display text-xl font-bold text-slate-950">Run</h2>

          {activeRun ? (
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    activeRun.status === "done"
                      ? "bg-emerald-50 text-emerald-700"
                      : activeRun.status === "failed"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {activeRun.status === "running" ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> running</>
                  ) : activeRun.status === "done" ? (
                    <><CheckCircle2 className="h-3 w-3" /> done</>
                  ) : (
                    <><XCircle className="h-3 w-3" /> failed</>
                  )}
                </span>
                <span className="text-xs text-slate-500">Run #{activeRun.id}</span>
              </div>

              {activeRun.error && (
                <div className="error mt-3">{activeRun.error}</div>
              )}

              <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
                {activeRun.events.length === 0 && <p className="text-sm text-slate-400">Menunggu event...</p>}
                {activeRun.events.map((ev) => {
                  const meta = EVENT_LABEL[ev.kind] ?? { icon: HelpCircle, cls: "text-slate-600 bg-slate-100", label: ev.kind };
                  return (
                    <div key={ev.id} className={`rounded-lg px-3 py-2 text-sm ${meta.cls}`}>
                      <span className="inline-flex items-center gap-1.5 font-bold">
                        <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                      </span>
                      {ev.stage_position !== null && <span className="opacity-60"> · stage #{ev.stage_position + 1}</span>}
                      {ev.content && <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5">{ev.content}</p>}
                    </div>
                  );
                })}
                <div ref={eventsEndRef} />
              </div>
            </div>
          ) : (
            <div className="empty mt-4">Belum ada run. Klik <b>Run Pipeline</b> buat mulai eksekusi.</div>
          )}

          <h3 className="mt-6 text-sm font-bold text-slate-800">Riwayat Run</h3>
          <div className="mt-2 flex flex-col gap-2">
            {runs.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada riwayat.</p>
            ) : (
              runs.map((r) => (
                <button
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-slate-300"
                  onClick={() => api.getRun(r.id).then(setActiveRun)}
                >
                  <span className="font-semibold text-slate-700">Run #{r.id}</span>
                  <span className="text-xs text-slate-500">
                    {r.started_at} · {r.status}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Modal: hasil export skill */}
      {exportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setExportData(null)}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-950">Skill: {exportData.skill_name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {exportData.stats.stages} stage · {exportData.stats.specialists} specialist · {exportData.stats.knowledge_notes} catatan knowledge
                  {exportData.stats.junk_filtered > 0 && (
                    <span className="text-rose-500"> · {exportData.stats.junk_filtered} sampah crawl di-filter</span>
                  )}
                  {exportData.stats.duplicate_filtered > 0 && (
                    <span className="text-amber-500"> · {exportData.stats.duplicate_filtered} duplikat di-skip</span>
                  )}
                </p>
              </div>
              <button className="btn small" onClick={() => setExportData(null)}><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              <p className="inline-flex items-center gap-1.5 font-bold"><Lightbulb className="h-4 w-4" /> Skill ini dijalanin oleh agent di tool lo, bukan backend.</p>
              <p className="mt-1">
                Download ZIP → install di PalHub desktop (store: <code className="rounded bg-white px-1">local:&lt;folder&gt;</code>) → inject ke Cursor/Codex/Claude Code/OpenCode.
                Setelah itu prompt <b>"gunakan development cycle untuk develop aplikasi finance"</b> di tool lo bakal nge-trigger skill ini + knowledge pajaknya.
              </p>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <a className="action-primary inline-flex items-center gap-1.5" href={api.exportPipelineSkillZipUrl(pipelineId)}>
                <Download className="h-4 w-4" /> Download {exportData.skill_name}.zip
              </a>
            </div>

            <h3 className="mt-5 text-sm font-bold text-slate-800">File ({exportData.files.length})</h3>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-600">
              {exportData.files.map((f) => (
                <div key={f.path} className="truncate px-1 py-0.5"><FileText className="mr-1 inline h-3 w-3" />{f.path}</div>
              ))}
            </div>

            <h3 className="mt-5 text-sm font-bold text-slate-800">SKILL.md preview</h3>
            <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-5 text-emerald-300">
              {exportData.skill_md}
            </pre>
          </div>
        </div>
      )}
    </main>
  );
}
