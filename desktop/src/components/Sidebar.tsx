import { useState, type DragEvent } from "react";
import {
  X,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  RotateCw,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { ScannedPage } from "../hooks/useFileActions";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  pages: ScannedPage[];
  activePageIndex: number;
  paperSize: string;
  orientation: "auto" | "portrait" | "landscape";
  onRotateCanvasLeft: () => void;
  onRotateCanvasRight: () => void;
  onSelect: (index: number) => void;
  onDelete: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

const PAPER_MM: Record<string, [number, number]> = {
  a4: [210, 297],
  letter: [216, 279],
  legal: [216, 356],
  folio: [210, 330],
  f4: [210, 330],
  b5: [176, 250],
  a5: [148, 210],
  a6: [105, 148],
  a3: [297, 420],
  executive: [184, 267],
  "com-10": [105, 241],
  dl: [110, 220],
  c5: [162, 229],
  monarch: [98, 191],
  ledger: [432, 279],
  "a5 long edge": [210, 148],
};

function paperAspect(
  paperSize: string,
  orientation: "auto" | "portrait" | "landscape",
) {
  const dims = PAPER_MM[(paperSize || "A4").toLowerCase().trim()] || PAPER_MM.a4;
  const land = orientation === "landscape";
  const width = land ? dims[1] : dims[0];
  const height = land ? dims[0] : dims[1];
  return `${width} / ${height}`;
}

function SidebarThumbImage({
  page,
  paperSize,
  orientation,
}: {
  page: ScannedPage;
  paperSize: string;
  orientation: "auto" | "portrait" | "landscape";
}) {
  const rotation = page.imageTransform?.rotation ?? 0;
  return (
    <div
      className="ps-sidebar-thumb-preview"
      style={{ aspectRatio: paperAspect(paperSize, orientation) }}
    >
      <img
        src={page.dataUrl}
        alt=""
        draggable={false}
        style={{
          objectFit: page.imageFit === "cover" ? "cover" : "contain",
          transform: `rotate(${rotation}deg)`,
        }}
      />
    </div>
  );
}

/**
 * Page navigation sidebar - thumbnail panel like Nitro / Acrobat.
 * Supports drag-to-reorder, delete, rotate, page navigation, and collapse.
 */
export default function Sidebar({
  open,
  onToggle,
  pages,
  activePageIndex,
  paperSize = "A4",
  orientation = "auto",
  onRotateCanvasLeft,
  onRotateCanvasRight,
  onSelect,
  onDelete,
  onReorder,
}: SidebarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function handleDragStart(e: DragEvent, index: number) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }
  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  }
  function handleDrop(e: DragEvent, toIndex: number) {
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

  const hasPages = pages.length > 0;

  if (!open) {
    return (
      <button
        className="ps-sidebar-reopen"
        title="Buka panel halaman"
        onClick={onToggle}
      >
        <PanelLeftOpen size={16} />
      </button>
    );
  }

  return (
    <aside className="ps-sidebar">
      <div className="ps-sidebar-head">
        <span className="ps-sidebar-title">Halaman</span>
        <div className="ps-sidebar-head-actions">
          <button
            className="ps-sidebar-icon"
            title="Putar kertas ke kiri"
            disabled={!hasPages}
            onClick={onRotateCanvasLeft}
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="ps-sidebar-icon"
            title="Putar kertas ke kanan"
            disabled={!hasPages}
            onClick={onRotateCanvasRight}
          >
            <RotateCw size={16} />
          </button>
          <button
            className="ps-sidebar-icon"
            title="Tutup panel"
            onClick={onToggle}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      <div className="ps-sidebar-body">
        <div className="ps-sidebar-thumbs">
          {pages.map((page, i) => {
            const cls =
              i === activePageIndex
                ? "ps-sidebar-thumb active"
                : i === overIndex && dragIndex !== null && dragIndex !== i
                  ? "ps-sidebar-thumb drop-target"
                  : "ps-sidebar-thumb";
            return (
              <div
                key={"page-" + i}
                className={cls}
                onClick={() => onSelect(i)}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
              >
                <button
                  className="ps-sidebar-thumb-close"
                  title="Hapus halaman"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(i);
                  }}
                >
                  <X size={10} />
                </button>
                {page.dataUrl ? (
                  <SidebarThumbImage
                    page={page}
                    paperSize={page.paperSize ?? paperSize}
                    orientation={page.paperOrientation ?? orientation}
                  />
                ) : (
                  <span className="ps-sidebar-thumb-empty">{i + 1}</span>
                )}
                <span className="ps-sidebar-thumb-num">{i + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ps-sidebar-foot">
        <button
          className="ps-sidebar-icon"
          title="Halaman sebelumnya"
          disabled={activePageIndex <= 0}
          onClick={() => onSelect(Math.max(0, activePageIndex - 1))}
        >
          <ChevronUp size={16} />
        </button>
        <span className="ps-sidebar-foot-label">
          {hasPages ? activePageIndex + 1 : 0} / {pages.length}
        </span>
        <button
          className="ps-sidebar-icon"
          title="Halaman berikutnya"
          disabled={activePageIndex >= pages.length - 1}
          onClick={() =>
            onSelect(Math.min(pages.length - 1, activePageIndex + 1))
          }
        >
          <ChevronDown size={16} />
        </button>
      </div>
    </aside>
  );
}
