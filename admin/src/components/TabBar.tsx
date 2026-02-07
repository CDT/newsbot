import { Icons } from "../Icons";

export type TabId = 'settings' | 'sources' | 'configs' | 'history';

interface Tab {
  id: TabId;
  label: string;
}

const tabs: Tab[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'sources', label: 'Sources' },
  { id: 'configs', label: 'Config Sets' },
  { id: 'history', label: 'Run History' },
];

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onReload?: (tab: TabId) => void;
  loadingTabs?: Partial<Record<TabId, boolean>>;
}

export function TabBar({ activeTab, onTabChange, onReload, loadingTabs = {} }: TabBarProps) {
  return (
    <nav className="tab-bar">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isLoading = loadingTabs[tab.id];
        return (
          <button
            key={tab.id}
            className={`tab-item ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
            {isLoading && <Icons.Loader />}
            {isActive && !isLoading && onReload && (
              <span
                className="tab-reload"
                role="button"
                title={`Reload ${tab.label}`}
                onClick={(e) => { e.stopPropagation(); onReload(tab.id); }}
              >
                <Icons.Refresh />
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
