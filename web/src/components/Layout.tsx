import { NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { BoltIcon, BrainIcon, GridIcon, PlayIcon, SparkIcon, TerminalIcon } from "./Icons";

const navItems = [
  {
    to: "/",
    label: "Specialists",
    description: "Catalog and orchestration",
    icon: GridIcon,
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const inPlayground = location.pathname.startsWith("/playground/");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <SparkIcon className="icon" />
          </div>
          <div>
            <div className="brand-name">PalHub</div>
            <div className="brand-tag">Agentic working tools</div>
          </div>
        </div>

        <div className="sidebar-panel sidebar-intro">
          <span className="eyebrow">Control Surface</span>
          <p>
            Build specialists, wire their tools into MCP, and operate the whole workflow from one product surface.
          </p>
        </div>

        <nav className="nav-stack">
          {navItems.map(({ to, label, description, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} end>
              <span className="nav-icon">
                <Icon className="icon" />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </NavLink>
          ))}
          <div className={`nav-link nav-link-static${inPlayground ? " active" : ""}`}>
            <span className="nav-icon accent-violet">
              <PlayIcon className="icon" />
            </span>
            <span>
              <strong>Playground</strong>
              <small>Prompt and inspect tool output</small>
            </span>
          </div>
        </nav>

        <div className="sidebar-stats">
          <div className="mini-stat">
            <BrainIcon className="icon" />
            <div>
              <strong>Knowledge-backed</strong>
              <span>Stored by specialist</span>
            </div>
          </div>
          <div className="mini-stat">
            <TerminalIcon className="icon" />
            <div>
              <strong>MCP-ready</strong>
              <span>/mcp streamable HTTP</span>
            </div>
          </div>
        </div>

        <div className="sidebar-foot">
          <div className="sidebar-foot-label">Live endpoint</div>
          <div className="sidebar-foot-value">
            <BoltIcon className="icon" />
            <code>POST /mcp</code>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="eyebrow">Operations Dashboard</span>
            <h1 className="topbar-title">{inPlayground ? "Tool Playground" : "Specialist Orchestration"}</h1>
          </div>
          <div className="topbar-chip">
            <SparkIcon className="icon" />
            <span>Modernized product UI</span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
