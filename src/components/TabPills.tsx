import "@/styles/components/tabs.css";

interface Tab {
  id: string;
  label: string;
}

interface TabPillsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
}

export function TabPills({ tabs, activeId, onChange }: TabPillsProps) {
  return (
    <div className="tab-pills" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          className={`tab-pills__tab ${activeId === tab.id ? "tab-pills__tab--active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
