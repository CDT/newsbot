import { Icons } from "../Icons";

type HeaderProps = {
  onLogout: () => void;
};

export function Header({ onLogout }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-logo">
          <div className="app-logo-icon">📰</div>
          <div>
            <h1>Newsbot Admin</h1>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={onLogout} style={{ color: "rgba(255,255,255,0.8)" }}>
          <Icons.LogOut />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
