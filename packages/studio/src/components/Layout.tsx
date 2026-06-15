import { ReactNode } from "react";
import { AppInfo, Page } from "../types";
import NavItem from "./NavItem";

interface NavEntry {
  page: Page;
  label: string;
  devOnly?: boolean;
}

const NAV: NavEntry[] = [
  { page: "summary", label: "Summary" },
  { page: "schema", label: "Schema Browser" },
  { page: "dashboard", label: "Dashboard" },
  { page: "search", label: "Search" },
  { page: "extensions", label: "Extensions" },
  { page: "health", label: "Health Check", devOnly: true },
  { page: "commands", label: "Command Panel", devOnly: true },
];

interface Props {
  info: AppInfo;
  page: Page;
  onNavigate: (p: Page) => void;
  onLogout: () => void;
  children: ReactNode;
}

export default function Layout({ info, page, onNavigate, onLogout, children }: Props) {
  const visible = NAV.filter((n) => !n.devOnly || info.dev_mode);
  const devItems = visible.filter((n) => n.devOnly);
  const mainItems = visible.filter((n) => !n.devOnly);

  return (
    <div className="vs-layout">
      <aside className="vs-sidebar">
        <div className="vs-sidebar-header">
          <span className="vs-logo">VeloIQ Studio</span>
          {info.dev_mode && <span className="vs-badge-dev">DEV</span>}
        </div>

        <nav className="vs-nav">
          {mainItems.map((n) => (
            <NavItem
              key={n.page}
              label={n.label}
              active={page === n.page}
              onClick={() => onNavigate(n.page)}
            />
          ))}

          {devItems.length > 0 && (
            <>
              <div className="vs-nav-section">Dev tools</div>
              {devItems.map((n) => (
                <NavItem
                  key={n.page}
                  label={n.label}
                  active={page === n.page}
                  devOnly
                  onClick={() => onNavigate(n.page)}
                />
              ))}
            </>
          )}
        </nav>

        <div className="vs-sidebar-footer">
          <div className="vs-app-name">{info.app_name}</div>
          <div className="vs-fw-version">v{info.framework_version}</div>
          <button className="vs-logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="vs-content">{children}</main>
    </div>
  );
}
