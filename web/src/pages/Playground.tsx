import { motion } from "framer-motion";
import { ArrowLeft, Cable, Copy, FlaskConical, Orbit, Play, TerminalSquare, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Specialist, Tool } from "../types";

const TOOL_TYPE_LABELS: Record<Tool["type"], string> = {
  crawl: "Crawl",
  generate_doc: "Generate Doc",
  knowledge_query: "Knowledge Query",
};

export default function Playground() {
  const { id } = useParams();
  const specialistId = Number(id);

  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [toolId, setToolId] = useState<number | "">("");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const specialist = useMemo(() => specialists.find((item) => item.id === specialistId), [specialists, specialistId]);
  const selectedTool = useMemo(() => tools.find((item) => item.id === toolId), [toolId, tools]);

  useEffect(() => {
    void (async () => {
      const [specs, toolList] = await Promise.all([api.listSpecialists(), api.listTools(specialistId)]);
      setSpecialists(specs);
      setTools(toolList);
      if (toolList.length > 0) setToolId(toolList[0].id);
    })();
  }, [specialistId]);

  const run = async () => {
    if (!toolId || !prompt.trim()) return;
    setBusy(true);
    setError("");
    setResult("");
    try {
      const res = await api.runTool(specialistId, toolId, prompt.trim());
      setResult(res.content);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(result);
  };

  return (
    <div className="space-y-6">
      <Link to={`/specialists/${specialistId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" />
        <span>Kembali ke workbench</span>
      </Link>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="hero-shell grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_380px]"
      >
        <div>
          <span className="eyebrow">Execution Console</span>
          <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-[-0.07em] text-slate-950 lg:text-[3rem]">
            Playground {specialist ? `for ${specialist.name}` : "loading..."}
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600 lg:text-base">
            Uji prompt, validasi perilaku tool, dan pastikan output yang keluar siap dipakai ulang dari client MCP lain.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="subtle-note bg-violet-50 text-violet-700 border-violet-200">
              <Cable className="h-4 w-4 text-violet-600" />
              <span>Output di sini setara dengan response yang dikirim lewat <code>/mcp</code>.</span>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-[24px] bg-gradient-to-br from-violet-500 to-violet-700 p-5 text-white shadow-[0_24px_50px_rgba(91,33,182,0.28)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-100/80">Available tools</div>
            <div className="mt-3 font-display text-5xl font-bold tracking-[-0.08em]">{tools.length}</div>
            <p className="mt-2 text-sm leading-6 text-violet-100/80">Choose one capability and run it against a realistic prompt.</p>
          </div>
          <div className="panel-surface-strong p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Selected mode</div>
            <div className="mt-3 font-display text-4xl font-bold tracking-[-0.08em] text-slate-950">{selectedTool ? TOOL_TYPE_LABELS[selectedTool.type] : "-"}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTool?.description || "Pick a tool to see its operating mode."}</p>
          </div>
        </div>
      </motion.section>

      {error && <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="panel-surface space-y-6 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="eyebrow">Prompt Composer</span>
              <h3 className="section-title mt-2">Run a tool interactively</h3>
            </div>
            <div className="metric-chip bg-violet-50 text-violet-700 border-violet-200">
              <FlaskConical className="h-4 w-4" />
              <span>Fast validation loop</span>
            </div>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="field-label">Tool</span>
              <select className="input-shell" value={toolId} onChange={(e) => setToolId(e.target.value ? Number(e.target.value) : "")}>
                {tools.length === 0 && <option value="">Belum ada tool</option>}
                {tools.map((tool) => (
                  <option key={tool.id} value={tool.id}>{TOOL_TYPE_LABELS[tool.type]} - {tool.name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="field-label">Prompt</span>
              <textarea
                rows={10}
                className="input-shell min-h-72 font-mono text-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  selectedTool
                    ? `Contoh untuk ${selectedTool.name}: ${selectedTool.type === "crawl" ? "cari sumber resmi terbaru tentang ..." : "susun jawaban atau dokumen berdasarkan konteks specialist ini ..."}`
                    : "Pilih tool terlebih dahulu"
                }
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="action-primary !from-violet-500 !to-violet-700 !shadow-[0_16px_30px_rgba(91,33,182,0.24)]" onClick={run} disabled={busy || !toolId || !prompt.trim()}>
              <Play className="h-4 w-4" />
              <span>{busy ? "Menjalankan..." : "Jalankan tool"}</span>
            </button>
            <div className="subtle-note">
              <Wrench className="h-4 w-4 text-brand-600" />
              <span>{selectedTool ? `${selectedTool.name} siap diuji.` : "Tambahkan tool di workbench bila list masih kosong."}</span>
            </div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.09 }} className="panel-surface p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="eyebrow">Output</span>
              <h3 className="section-title mt-2">Execution result</h3>
            </div>
            {result && (
              <button className="action-secondary" onClick={copy}>
                <Copy className="h-4 w-4" />
                <span>Copy hasil</span>
              </button>
            )}
          </div>

          <div className="mt-6">
            {result ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    <Orbit className="h-4 w-4 text-brand-600" />
                    <span>Run complete</span>
                  </div>
                  <div className="metric-chip">Tool: {selectedTool?.name ?? "-"}</div>
                </div>
                <motion.pre initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-auto rounded-[24px] border border-slate-800/10 bg-slate-950 p-5 font-mono text-sm leading-7 text-slate-100 shadow-inner">
                  {result}
                </motion.pre>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 p-8">
                <div className="flex items-start gap-3">
                  <TerminalSquare className="mt-1 h-5 w-5 text-brand-600" />
                  <div>
                    <div className="font-semibold text-slate-950">Belum ada hasil.</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">Jalankan tool untuk melihat payload respons yang sama dengan integrasi MCP.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
