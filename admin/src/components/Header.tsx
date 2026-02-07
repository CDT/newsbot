import { Icons } from "../Icons";

type HeaderProps = {
  onLogout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export function Header({ onLogout, theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-logo">
          <div className="app-logo-icon">📰</div>
          <div>
            <h1>Newsbot Admin</h1>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="header-theme-toggle"
            onClick={onToggleTheme}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? <Icons.Moon /> : <Icons.Sun />}
          </button>
          <button className="btn btn-ghost header-logout-btn" onClick={onLogout}>
            <Icons.LogOut />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
