import { motion } from "framer-motion";
import { Blocks, Cable, ChevronRight, FileText, FlaskConical, Layers3, Orbit, Plus, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Specialist } from "../types";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "SP"
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
};

const capabilityItems: Array<{ icon: LucideIcon; text: string }> = [
  { icon: Wrench, text: "Build tools that can be executed from PalHub and exposed to external clients." },
  { icon: FileText, text: "Capture procedure structure so generated output stays consistent." },
  { icon: Orbit, text: "Grow specialist-scoped context instead of mixing operational knowledge." },
];

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

  const totals = useMemo(
    () =>
      specialists.reduce(
        (acc, specialist) => {
          acc.tools += specialist.tool_count;
          acc.procedures += specialist.procedure_count;
          acc.knowledge += specialist.knowledge_count;
          return acc;
        },
        { tools: 0, procedures: 0, knowledge: 0 }
      ),
    [specialists]
  );

  return (
    <div className="space-y-6">
      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="hero-shell grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]"
      >
        <div className="relative z-10">
          <span className="eyebrow">Operational Catalog</span>
          <h2 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-none tracking-[-0.07em] text-slate-950 lg:text-[3.35rem]">
            Build specialists that look like real operating units.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600 lg:text-base">
            PalHub organizes specialists, tools, procedures, and stored context into one structured surface that is ready to serve both web and MCP consumers.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button className="action-primary" onClick={create} disabled={busy || !name.trim()}>
              <Plus className="h-4 w-4" />
              <span>{busy ? "Menyimpan..." : "Buat Specialist"}</span>
            </button>
            <div className="subtle-note">
              <Cable className="h-4 w-4 text-brand-600" />
              <span>Tool aktif langsung siap dikonsumsi via MCP.</span>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.04 }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <div className="rounded-[24px] bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white shadow-[0_24px_50px_rgba(20,101,91,0.28)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-50/80">Active specialists</div>
            <div className="mt-3 font-display text-5xl font-bold tracking-[-0.08em]">{specialists.length}</div>
            <p className="mt-2 text-sm leading-6 text-teal-50/80">Persona yang sudah siap dikelola dan diperkaya.</p>
          </div>
          <div className="panel-surface-strong p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Tool volume</div>
            <div className="mt-3 font-display text-5xl font-bold tracking-[-0.08em] text-slate-950">{totals.tools}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Eksekutor yang bisa dipanggil ulang lewat UI maupun MCP.</p>
          </div>
          <div className="panel-surface-strong p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Procedures</div>
            <div className="mt-3 font-display text-5xl font-bold tracking-[-0.08em] text-slate-950">{totals.procedures}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Blueprint dokumen dan struktur alur kerja specialist.</p>
          </div>
          <div className="panel-surface-strong bg-gradient-to-br from-violet-50 to-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Stored context</div>
            <div className="mt-3 font-display text-5xl font-bold tracking-[-0.08em] text-slate-950">{totals.knowledge}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Knowledge node yang menjaga hasil tetap relevan per specialist.</p>
          </div>
        </motion.div>
      </motion.section>

      {error && <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_380px]">
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="show"
          transition={{ duration: 0.35, delay: 0.06 }}
          className="panel-surface p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="eyebrow">Create New</span>
              <h3 className="section-title mt-2">Tambah specialist baru</h3>
            </div>
            <div className="metric-chip">
              <Blocks className="h-4 w-4" />
              <span>Persona + tools + procedures</span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="field-label">Nama specialist</span>
              <input className="input-shell" value={name} onChange={(e) => setName(e.target.value)} placeholder="Finance Intelligence" />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <span className="field-label">Deskripsi persona</span>
              <textarea
                className="input-shell min-h-36"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ahli yang fokus pada insight, output dokumentasi, dan retrieval knowledge yang siap dipakai lintas interface."
              />
            </label>
          </div>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
            <Layers3 className="h-4 w-4 text-brand-600" />
            <span>Deskripsi yang tajam akan memudahkan positioning dan scope tiap specialist.</span>
          </div>
        </motion.section>

        <motion.aside
          variants={fadeUp}
          initial="hidden"
          animate="show"
          transition={{ duration: 0.35, delay: 0.1 }}
          className="panel-surface p-6"
        >
          <span className="eyebrow">What This Unlocks</span>
          <h3 className="section-title mt-2">One place to define the full working unit.</h3>
          <div className="mt-6 space-y-4">
            {capabilityItems.map(({ icon: Icon, text }) => (
              <div key={text} className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                <Icon className="mt-0.5 h-4.5 w-4.5 text-brand-600" />
                <p className="text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </motion.aside>
      </div>

      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.35, delay: 0.14 }}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="eyebrow">Inventory</span>
            <h3 className="section-title mt-2">Specialist roster</h3>
          </div>
          <div className="metric-chip border-violet-200 bg-violet-50 text-violet-700">
            <FlaskConical className="h-4 w-4" />
            <span>Playground attached per specialist</span>
          </div>
        </div>

        {loading ? (
          <div className="panel-surface p-8 text-sm font-semibold text-slate-500">Loading specialists...</div>
        ) : specialists.length === 0 ? (
          <div className="panel-surface flex items-start gap-4 p-8">
            <Blocks className="mt-1 h-5 w-5 text-brand-600" />
            <div>
              <div className="font-semibold text-slate-950">Belum ada specialist.</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Mulai dari satu persona yang paling sering dipakai tim, lalu isi tools, procedures, dan stored context-nya.
              </p>
            </div>
          </div>
        ) : (
          <motion.div layout className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {specialists.map((specialist, index) => (
              <motion.article
                key={specialist.id}
                layout
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: index * 0.04 }}
                className="panel-surface-strong flex h-full flex-col gap-5 p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-50 font-display text-lg font-bold tracking-[0.06em] text-brand-700 ring-1 ring-brand-100">
                    {initials(specialist.name)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-display text-xl font-bold tracking-[-0.04em] text-slate-950">{specialist.name}</h4>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{specialist.description || "Tanpa deskripsi persona."}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="metric-chip">
                    <Wrench className="h-4 w-4" />
                    {specialist.tool_count} tools
                  </span>
                  <span className="metric-chip">
                    <FileText className="h-4 w-4" />
                    {specialist.procedure_count} procedures
                  </span>
                  <span className="metric-chip metric-chip-success">
                    <Layers3 className="h-4 w-4" />
                    {specialist.knowledge_count} knowledge
                  </span>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3">
                  <Link to={`/specialists/${specialist.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition hover:text-brand-800">
                    <span>Open workbench</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link to={`/playground/${specialist.id}`} className="action-secondary !rounded-2xl !border-violet-200 !bg-violet-50 !px-4 !py-2.5 !text-violet-700">
                    <FlaskConical className="h-4 w-4" />
                    <span>Playground</span>
                  </Link>
                </div>
              </motion.article>
            ))}
          </motion.div>
        )}
      </motion.section>
    </div>
  );
}
