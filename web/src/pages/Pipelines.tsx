import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Pipeline } from "../types";

export default function Pipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setPipelines(await api.listPipelines());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    try {
      setSaving(true);
      const p = await api.createPipeline({ name: name.trim(), description: description.trim() });
      setShowCreate(false);
      setName("");
      setDescription("");
      window.location.href = `/pipelines/${p.id}`;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-4 pb-0 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.05em] text-slate-950">
            Orchestrator Pipelines
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate-600">
            Rangkai specialist jadi pipeline. Tiap stage di-eksekusi berurutan, dan stage yang butuh
            info tambahan otomatis manggil specialist lain (agent-to-agent).
          </p>
        </div>
        <button className="action-primary" onClick={() => setShowCreate(true)}>
          + New Pipeline
        </button>
      </header>

      {error && <div className="notice mt-4 !text-rose-700 !border-rose-200 !bg-rose-50">{error}</div>}

      {showCreate && (
        <div className="panel-surface mt-6 p-6">
          <h2 className="font-display text-xl font-bold text-slate-950">Buat Pipeline Baru</h2>
          <div className="mt-4 flex flex-col gap-3">
            <input
              className="input-shell"
              placeholder="Nama pipeline (misal: Tax → Requirement)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              className="input-shell min-h-24"
              placeholder="Deskripsi (opsional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex gap-3">
              <button className="action-primary" disabled={saving || !name.trim()} onClick={create}>
                {saving ? "Menyimpan..." : "Buat & Konfigurasi"}
              </button>
              <button className="action-secondary" onClick={() => setShowCreate(false)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-8 text-center text-slate-500">Loading pipelines...</div>
      ) : pipelines.length === 0 ? (
        <div className="panel-surface mt-8 p-10 text-center">
          <p className="text-lg font-semibold text-slate-700">Belum ada pipeline</p>
          <p className="mt-2 text-sm text-slate-500">
            Klik <b>+ New Pipeline</b> buat mulai. Contoh: Finance share knowledge → BA gather → Translate.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pipelines.map((p) => (
            <Link key={p.id} to={`/pipelines/${p.id}`} className="panel-surface block p-5 transition hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-bold text-slate-950">{p.name}</h3>
                <span className="metric-chip shrink-0">{p.stage_count} stage</span>
              </div>
              {p.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{p.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
