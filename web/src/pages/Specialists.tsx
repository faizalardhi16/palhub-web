import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { BoltIcon, BookIcon, BrainIcon, ChevronRightIcon, GridIcon, PlayIcon, PlusIcon, ToolIcon } from "../components/Icons";
import type { Specialist } from "../types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "SP";
}

export default function Specialists() {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setSpecialists(await api.listSpecialists());
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
    setBusy(true);
    try {
      await api.createSpecialist({ name: name.trim(), description: description.trim() });
      setName("");
      setDescription("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => {
    return specialists.reduce(
      (acc, specialist) => {
        acc.tools += specialist.tool_count;
        acc.procedures += specialist.procedure_count;
        acc.knowledge += specialist.knowledge_count;
        return acc;
      },
      { tools: 0, procedures: 0, knowledge: 0 }
    );
  }, [specialists]);

  return (
    <div className="page-stack">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">Agent Stack Builder</span>
          <h2 className="hero-title">Design specialists that feel production-ready, not stitched together.</h2>
          <p className="hero-text">
            PalHub turns each specialist into a reusable operating unit with tools, procedures, knowledge, and a direct MCP surface.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={create} disabled={busy || !name.trim()}>
              <PlusIcon className="icon" />
              <span>{busy ? "Menyimpan..." : "Buat Specialist"}</span>
            </button>
            <div className="inline-note">
              <BoltIcon className="icon" />
              <span>Semua tool yang aktif langsung bisa dikonsumsi via MCP.</span>
            </div>
          </div>
        </div>

        <div className="hero-grid">
          <div className="metric-card metric-card-primary">
            <span className="metric-label">Active specialists</span>
            <strong>{specialists.length}</strong>
            <p>Persona yang siap dioperasikan dan diperkaya.</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">Total tools</span>
            <strong>{totals.tools}</strong>
            <p>Eksekutor yang bisa dipanggil ulang lewat UI dan MCP.</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">Procedures</span>
            <strong>{totals.procedures}</strong>
            <p>Blueprint dokumen dan alur kerja per specialist.</p>
          </div>
          <div className="metric-card metric-card-accent">
            <span className="metric-label">Knowledge nodes</span>
            <strong>{totals.knowledge}</strong>
            <p>Context store yang menjaga kualitas output tetap relevan.</p>
          </div>
        </div>
      </section>

      {error && <div className="err-box">{error}</div>}

      <section className="split-section">
        <div className="surface-card form-panel">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Create New</span>
              <h3>Tambah specialist baru</h3>
            </div>
            <div className="section-chip">
              <GridIcon className="icon" />
              <span>Persona + tools + knowledge</span>
            </div>
          </div>

          <div className="field-grid">
            <div className="field">
              <label>Nama specialist</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Finance Intelligence" />
            </div>
            <div className="field field-span-2">
              <label>Deskripsi persona</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ahli yang fokus pada insight, output dokumentasi, dan knowledge retrieval yang siap dipakai lintas interface."
              />
            </div>
          </div>

          <div className="panel-footnote">
            <BrainIcon className="icon" />
            <span>Gunakan deskripsi yang tajam supaya setiap specialist punya positioning kerja yang jelas.</span>
          </div>
        </div>

        <div className="surface-card insight-panel">
          <span className="eyebrow">What This Unlocks</span>
          <h3>One place to define the full working unit.</h3>
          <ul className="feature-list">
            <li>
              <ToolIcon className="icon" />
              <span>Build tools that can be executed from PalHub and exposed to external clients.</span>
            </li>
            <li>
              <BookIcon className="icon" />
              <span>Capture procedure structure so document generation stays consistent.</span>
            </li>
            <li>
              <BrainIcon className="icon" />
              <span>Grow specialist-specific knowledge instead of mixing context across teams.</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Inventory</span>
            <h3>Specialist roster</h3>
          </div>
          <div className="section-chip">
            <PlayIcon className="icon" />
            <span>Playground attached per specialist</span>
          </div>
        </div>

        {loading ? (
          <div className="spinner">Loading specialists...</div>
        ) : specialists.length === 0 ? (
          <div className="empty-state">
            <GridIcon className="icon" />
            <div>
              <strong>Belum ada specialist.</strong>
              <p>Mulai dengan satu persona yang paling sering dipakai tim, lalu isi tools, procedures, dan knowledge-nya.</p>
            </div>
          </div>
        ) : (
          <div className="card-grid">
            {specialists.map((specialist) => (
              <article className="specialist-card" key={specialist.id}>
                <div className="specialist-card-head">
                  <div className="avatar-badge">{initials(specialist.name)}</div>
                  <div>
                    <h4>{specialist.name}</h4>
                    <p>{specialist.description || "Tanpa deskripsi persona."}</p>
                  </div>
                </div>

                <div className="stats-row">
                  <span className="metric-pill">
                    <ToolIcon className="icon" />
                    {specialist.tool_count} tools
                  </span>
                  <span className="metric-pill">
                    <BookIcon className="icon" />
                    {specialist.procedure_count} procedures
                  </span>
                  <span className="metric-pill metric-pill-success">
                    <BrainIcon className="icon" />
                    {specialist.knowledge_count} knowledge
                  </span>
                </div>

                <div className="card-footer-actions">
                  <Link to={`/specialists/${specialist.id}`} className="text-link-action">
                    <span>Open workbench</span>
                    <ChevronRightIcon className="icon" />
                  </Link>
                  <Link to={`/playground/${specialist.id}`}>
                    <button className="secondary accent-violet">
                      <PlayIcon className="icon" />
                      <span>Playground</span>
                    </button>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
