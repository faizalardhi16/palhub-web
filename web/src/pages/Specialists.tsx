import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Specialist } from "../types";

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

  return (
    <div>
      <h1>Specialists</h1>
      <p className="sub">
        Bangun specialist dengan tools + procedures + knowledge. Tools otomatis di-expose ke MCP — bisa dipanggil dari
        Cursor, Codex, Claude Code, dll.
      </p>

      {error && <div className="err-box">{error}</div>}

      <div className="panel">
        <h2>➕ Specialist baru</h2>
        <div className="field">
          <label>Nama</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Finance" />
        </div>
        <div className="field">
          <label>Deskripsi (persona agent)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ahli keuangan & perpajakan Indonesia..."
          />
        </div>
        <button className="primary" onClick={create} disabled={busy || !name.trim()}>
          {busy ? "Menyimpan..." : "Buat Specialist"}
        </button>
      </div>

      {loading ? (
        <div className="spinner">Loading...</div>
      ) : specialists.length === 0 ? (
        <div className="empty">Belum ada specialist. Buat satu di atas.</div>
      ) : (
        <div className="grid">
          {specialists.map((s) => (
            <div className="card" key={s.id}>
              <h3>{s.name}</h3>
              <p>{s.description || "Tanpa deskripsi"}</p>
              <div className="stats">
                <span className="badge">🛠️ {s.tool_count} tools</span>
                <span className="badge">📋 {s.procedure_count} procedures</span>
                <span className="badge badge-green">🧠 {s.knowledge_count} knowledge</span>
              </div>
              <div className="row">
                <Link to={`/specialists/${s.id}`}>
                  <button>Kelola</button>
                </Link>
                <Link to={`/playground/${s.id}`}>
                  <button className="primary">▶ Playground</button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
