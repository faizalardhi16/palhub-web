import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Blocks, Cable, FlaskConical, Layers3, Orbit, PanelsTopLeft, Workflow } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

const navItems = [
  {
    to: "/",
    label: "Specialists",
    description: "Catalog and orchestration",
    icon: Blocks,
  },
  {
    to: "/pipelines",
    label: "Pipelines",
    description: "Agent-to-agent pipelines",
    icon: Workflow,
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const inPlayground = location.pathname.startsWith("/playground/");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
      <motion.aside
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="border-b border-white/10 bg-gradient-to-b from-[#08111f] to-[#0f172a] px-5 py-6 text-slate-100 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-r-white/8 lg:px-6"
      >
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10">
              <PanelsTopLeft className="h-5 w-5 text-teal-200" />
            </div>
            <div>
              <div className="font-display text-xl font-bold tracking-[-0.04em] text-white">PalHub</div>
              <div className="text-sm text-slate-400">Operational tool workspace</div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
            <span className="inline-flex text-[11px] font-bold uppercase tracking-[0.24em] text-teal-200">Control Surface</span>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Build operational specialists, publish their tools to MCP, and manage the whole workflow from one clean surface.
            </p>
          </div>

          <nav className="grid gap-2">
            {navItems.map(({ to, label, description, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                    isActive
                      ? "border-teal-300/35 bg-white/12"
                      : "border-white/10 bg-white/6 hover:border-white/20 hover:bg-white/10"
                  }`
                }
              >
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10">
                  <Icon className="h-4.5 w-4.5 text-slate-100" />
                </span>
                <span>
                  <strong className="block text-sm font-semibold text-white">{label}</strong>
                  <small className="block text-xs text-slate-400">{description}</small>
                </span>
              </NavLink>
            ))}
            <div
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                inPlayground ? "border-violet-300/35 bg-white/12" : "border-white/10 bg-white/6"
              }`}
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/20">
                <FlaskConical className="h-4.5 w-4.5 text-violet-200" />
              </span>
              <span>
                <strong className="block text-sm font-semibold text-white">Playground</strong>
                <small className="block text-xs text-slate-400">Run and inspect tool output</small>
              </span>
            </div>
          </nav>

          <div className="grid gap-2">
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 p-3">
              <Layers3 className="h-4.5 w-4.5 text-slate-200" />
              <div>
                <div className="text-sm font-semibold text-white">Structured knowledge</div>
                <div className="text-xs text-slate-400">Stored per specialist</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 p-3">
              <Cable className="h-4.5 w-4.5 text-slate-200" />
              <div>
                <div className="text-sm font-semibold text-white">MCP connected</div>
                <div className="text-xs text-slate-400">Streamable HTTP endpoint</div>
              </div>
            </div>
          </div>

          <div className="mt-auto rounded-[24px] border border-white/10 bg-white/6 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Live endpoint</div>
            <div className="mt-2 inline-flex items-center gap-2 font-mono text-sm text-slate-100">
              <Orbit className="h-4 w-4 text-teal-200" />
              <code>POST /mcp</code>
            </div>
          </div>
        </div>
      </motion.aside>

      <div className="min-w-0">
        <header className="page-shell flex flex-col gap-4 pb-0 lg:flex-row lg:items-start lg:justify-between">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <span className="eyebrow">Operations Dashboard</span>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.05em] text-slate-950 lg:text-[2.1rem]">
              {inPlayground ? "Tool Playground" : "Specialist Orchestration"}
            </h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="subtle-note"
          >
            <PanelsTopLeft className="h-4 w-4 text-brand-600" />
            <span>Tailwind + motion powered UI</span>
          </motion.div>
        </header>
        <main className="page-shell">{children}</main>
      </div>
    </div>
  );
}
