"use client";

type LibraryTabKey = "premises" | "model_outputs";

type LibraryTabsProps = {
  activeTab: LibraryTabKey;
  onChange: (tab: LibraryTabKey) => void;
};

const TAB_COPY: Array<{ key: LibraryTabKey; label: string }> = [
  { key: "premises", label: "Premisas" },
  { key: "model_outputs", label: "Resultados de modelos" },
];

export default function LibraryTabs({ activeTab, onChange }: LibraryTabsProps) {
  return (
    <div className="inline-flex rounded-2xl bg-[var(--surface-muted)] p-1">
      {TAB_COPY.map((tab) => {
        const active = tab.key === activeTab;

        return (
          <button
            key={tab.key}
            type="button"
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-white text-[var(--foreground)] shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
