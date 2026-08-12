import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Specialist, Tool } from "../types";

const TOOL_TYPE_LABELS: Record<Tool["type"], string> = {
  crawl: "🕷️ Crawl",
  generate_doc: "📄 Generate Doc",
  knowledge_query: "🔍 Knowledge Query",
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

  const specialist = useMemo(
    () => specialists.find((s) => s.id === specialistId),
    [specialists, specialistId]
  );

  useEffect(() => {
    void (async () => {
      const [specs, ts] = await Promise.all([
        api.listSpecialists(),
        api.listTools(specialistId),
      ]);
      setSpecialists(specs);
      setTools(ts);
      if (ts.length > 0) setToolId(ts[0].id);
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
    <div>
      <Link to="/" className="back-link">
        ← Semua specialists
      </Link>
      <h1>▶ Playground — {specialist?.name ?? "..."}</h1>
      <p className="sub">
        Test tool sebelum dipakai dari Cursor/Codex. Hasil yang sama akan dikembalikan lewat MCP{" "}
        <code>/mcp</code>.
      </p>

      <div className="panel">
        <div className="field">
          <label>Tool</label>
          <select value={toolId} onChange={(e) => setToolId(e.target.value ? Number(e.target.value) : "")}>
            {tools.length === 0 && <option value="">Belum ada tool</option>}
            {tools.map((t) => (
              <option key={t.id} value={t.id}>
                {TOOL_TYPE_LABELS[t.type]} — {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Prompt</label>
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={toolId ? `Contoh: ${tools.find((t) => t.id === toolId)?.name === "crawl" ? "cari aturan pajak terbaru..." : "jelaskan prosedur renew CoA..."}` : ""}
          />
        </div>
        <button className="primary" onClick={run} disabled={busy || !toolId || !prompt.trim()}>
          {busy ? "Menjalankan..." : "▶ Jalankan"}
        </button>
      </div>

      {error && <div className="err-box">{error}</div>}

      {result && (
        <div className="panel">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Hasil</h2>
            <button onClick={copy}>📋 Copy</button>
          </div>
          <pre className="result-box">{result}</pre>
        </div>
      )}
    </div>
  );
}
