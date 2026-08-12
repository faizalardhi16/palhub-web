import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">🧠</span>
          <div>
            <div className="brand-name">PalHub</div>
            <div className="brand-tag">Agentic Working Tools</div>
          </div>
        </div>
        <nav>
          <Link to="/" className="nav-link">
            🗂️ Specialists
          </Link>
        </nav>
        <div className="sidebar-foot">
          <code>POST /mcp</code> — Streamable HTTP
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
