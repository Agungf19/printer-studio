import { useState } from "react";
import { X } from "lucide-react";
import type { ScannedPage } from "../hooks/useFileActions";

interface PageScrollbarProps {
  pages: ScannedPage[];
  activePageIndex: number;
  onSelect: (index: number) => void;
  onDelete: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

/**
 * Vertical thumbnail strip for page navigation — like Nitro PDF.
 * Supports drag-to-reorder and delete.
 */
export default function PageScrollbar({
  pages,
  activePageIndex,
  onSelect,
  onDelete,
  onReorder,
}: PageScrollbarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    const fromIndex = dragIndex;
    if (fromIndex !== null && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <div className="ps-page-scrollbar">
      {pages.map((page, i) => (
        <div
          key={`page-${i}`}
          className={
            i === activePageIndex
              ? "ps-page-thumb active"
              : i === overIndex && dragIndex !== null && dragIndex !== i
                ? "ps-page-thumb drop-target"
                : "ps-page-thumb"
          }
          onClick={() => onSelect(i)}
          draggable
          onDragStart={(e) => handleDragStart(e, i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDrop={(e) => handleDrop(e, i)}
          onDragEnd={handleDragEnd}
        >
          <button
            className="ps-page-thumb-close"
            title="Hapus halaman"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(i);
            }}
          >
            <X size={10} />
          </button>
          {page.dataUrl ? (
            <img
              src={page.dataUrl}
              alt={`Halaman ${i + 1}`}
              draggable={false}
            />
          ) : (
            <span className="ps-page-thumb-empty">{i + 1}</span>
          )}
          <span className="ps-page-thumb-num">{i + 1}</span>
        </div>
      ))}
    </div>
  );
}
