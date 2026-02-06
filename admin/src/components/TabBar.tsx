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
  loadingTabs?: Partial<Record<TabId, boolean>>;
}

export function TabBar({ activeTab, onTabChange, loadingTabs = {} }: TabBarProps) {
  return (
    <nav className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
          {loadingTabs[tab.id] && <Icons.Loader />}
        </button>
      ))}
    </nav>
  );
}
