import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ArrowLeftIcon, BoltIcon, CopyIcon, PlayIcon, SparkIcon, TerminalIcon, ToolIcon } from "../components/Icons";
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
    <div className="page-stack">
      <Link to={`/specialists/${specialistId}`} className="back-link">
        <ArrowLeftIcon className="icon" />
        <span>Kembali ke workbench</span>
      </Link>

      <section className="hero-section compact-hero playground-hero">
        <div className="hero-copy">
          <span className="eyebrow">Execution Console</span>
          <h2 className="hero-title">Playground {specialist ? `for ${specialist.name}` : "loading..."}</h2>
          <p className="hero-text">
            Uji prompt, validasi perilaku tool, dan pastikan hasilnya siap dipakai ulang dari client MCP yang lain.
          </p>
          <div className="hero-actions">
            <div className="inline-note violet-note">
              <TerminalIcon className="icon" />
              <span>Output di sini setara dengan response yang dikirim lewat <code>/mcp</code>.</span>
            </div>
          </div>
        </div>

        <div className="hero-grid hero-grid-2">
          <div className="metric-card metric-card-violet">
            <span className="metric-label">Available tools</span>
            <strong>{tools.length}</strong>
            <p>Choose one capability and run it against a realistic prompt.</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">Selected mode</span>
            <strong>{selectedTool ? TOOL_TYPE_LABELS[selectedTool.type] : "-"}</strong>
            <p>{selectedTool?.description || "Pick a tool to see its operating mode."}</p>
          </div>
        </div>
      </section>

      {error && <div className="err-box">{error}</div>}

      <section className="split-section detail-split">
        <div className="surface-card form-panel accent-violet-surface">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Prompt Composer</span>
              <h3>Run a tool interactively</h3>
            </div>
            <div className="section-chip accent-violet-soft">
              <SparkIcon className="icon" />
              <span>Fast validation loop</span>
            </div>
          </div>

          <div className="field-grid">
            <div className="field field-span-2">
              <label>Tool</label>
              <select value={toolId} onChange={(e) => setToolId(e.target.value ? Number(e.target.value) : "")}>
                {tools.length === 0 && <option value="">Belum ada tool</option>}
                {tools.map((tool) => (
                  <option key={tool.id} value={tool.id}>
                    {TOOL_TYPE_LABELS[tool.type]} - {tool.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field-span-2">
              <label>Prompt</label>
              <textarea
                rows={8}
                className="mono"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  selectedTool
                    ? `Contoh untuk ${selectedTool.name}: ${selectedTool.type === "crawl" ? "cari sumber resmi terbaru tentang ..." : "susun jawaban atau dokumen berdasarkan konteks specialist ini ..."}`
                    : "Pilih tool terlebih dahulu"
                }
              />
            </div>
          </div>

          <div className="hero-actions">
            <button className="primary accent-violet" onClick={run} disabled={busy || !toolId || !prompt.trim()}>
              <PlayIcon className="icon" />
              <span>{busy ? "Menjalankan..." : "Jalankan tool"}</span>
            </button>
            <div className="inline-note">
              <ToolIcon className="icon" />
              <span>{selectedTool ? `${selectedTool.name} siap diuji.` : "Tambahkan tool di workbench bila list masih kosong."}</span>
            </div>
          </div>
        </div>

        <div className="surface-card list-panel result-panel-shell">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Output</span>
              <h3>Execution result</h3>
            </div>
            {result && (
              <button className="secondary" onClick={copy}>
                <CopyIcon className="icon" />
                <span>Copy hasil</span>
              </button>
            )}
          </div>

          {result ? (
            <div className="result-panel">
              <div className="result-panel-head">
                <div className="result-status">
                  <BoltIcon className="icon" />
                  <span>Run complete</span>
                </div>
                <div className="meta-pill">Tool: {selectedTool?.name ?? "-"}</div>
              </div>
              <pre className="result-box">{result}</pre>
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <TerminalIcon className="icon" />
              <div>
                <strong>Belum ada hasil.</strong>
                <p>Jalankan tool untuk melihat payload respons yang sama dengan integrasi MCP.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
