import type { ScannerItem } from "../api/client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatusDot } from "./RibbonHelpers";

export default function StatusBar({
  backendStatus,
  selectedScanner,
  printerName,
  scannedPagesCount,
  activePageIndex,
  onPageChange,
  zoom,
  onZoomChange,
}: {
  backendStatus: "checking" | "online" | "offline";
  selectedScanner?: ScannerItem;
  printerName: string;
  scannedPagesCount: number;
  activePageIndex: number;
  onPageChange: (index: number) => void;
  zoom: number;
  onZoomChange: (value: number) => void;
}) {
  return (
    <footer className="ps-statusbar">
      <span>
        <StatusDot
          tone={
            backendStatus === "online"
              ? "on"
              : backendStatus === "checking"
                ? "busy"
                : "off"
          }
        />{" "}
        Backend:{" "}
        {backendStatus === "online"
          ? "Terhubung"
          : backendStatus === "checking"
            ? "Memeriksa"
            : "Offline"}{" "}
        (FastAPI · 127.0.0.1:8765)
      </span>
      <span>Scanner: {selectedScanner?.name || "-"}</span>
      <span>Printer: {printerName} — Antrean kosong</span>
      <span className="spacer" />
      {scannedPagesCount > 0 && (
        <span className="ps-page-nav">
          <button
            className="ps-page-nav-btn"
            disabled={activePageIndex <= 0}
            onClick={() => onPageChange(activePageIndex - 1)}
            title="Halaman sebelumnya"
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            Halaman {activePageIndex + 1} dari {scannedPagesCount}
          </span>
          <button
            className="ps-page-nav-btn"
            disabled={activePageIndex >= scannedPagesCount - 1}
            onClick={() => onPageChange(activePageIndex + 1)}
            title="Halaman berikutnya"
          >
            <ChevronRight size={14} />
          </button>
        </span>
      )}
      <span className="ps-zoom">
        <button onClick={() => onZoomChange(zoom - 10)}>−</button>
        <input
          type="range"
          min="50"
          max="200"
          step="10"
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
        />
        <button onClick={() => onZoomChange(zoom + 10)}>+</button>
        <b>{zoom}%</b>
      </span>
    </footer>
  );
}
