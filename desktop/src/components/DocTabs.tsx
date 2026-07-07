import { useState } from "react";
import { Plus } from "lucide-react";
import type { DocumentState } from "../hooks/useFileActions";

export default function DocTabs({
  documents,
  activeDocIndex,
  onSelect,
  onClose,
  onNew,
  onRename,
}: {
  documents: DocumentState[];
  activeDocIndex: number;
  onSelect: (index: number) => void;
  onClose: (index: number) => void;
  onNew: () => void;
  onRename: (index: number, title: string) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  function startRename(index: number, currentTitle: string) {
    setEditingIndex(index);
    setEditValue(currentTitle);
  }

  function commitRename() {
    if (editingIndex !== null && editValue.trim()) {
      onRename(editingIndex, editValue.trim());
    }
    setEditingIndex(null);
  }

  return (
    <div className="ps-doc-tabs">
      {documents.map((doc, i) => {
        const unsaved = !!doc.dirty && doc.pages.length > 0;
        return (
          <button
            key={doc.id}
            className={
              i === activeDocIndex ? "ps-doc-tab active" : "ps-doc-tab"
            }
            title={`${unsaved ? "• Belum disimpan\n" : ""}${doc.title} (${doc.pages.length} halaman)`}
            onClick={() => onSelect(i)}
            onDoubleClick={() => startRename(i, doc.title)}
          >
            {editingIndex === i ? (
              <input
                className="ps-doc-tab-rename"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingIndex(null);
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span>
                  {unsaved ? "* " : ""}
                  {doc.title}
                </span>
                {doc.pages.length > 1 && (
                  <span className="ps-doc-tab-count">{doc.pages.length}</span>
                )}
                <span
                  className="x"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(i);
                  }}
                >
                  ×
                </span>
              </>
            )}
          </button>
        );
      })}
      <button className="ps-doc-add" onClick={onNew}>
        <Plus size={15} />
      </button>
    </div>
  );
}
