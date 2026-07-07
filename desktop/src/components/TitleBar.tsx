import {
  Minus,
  Maximize2,
  X,
  Printer,
  Save,
  Undo2,
  Redo2,
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import { IconOnly } from "./RibbonHelpers";

const sp = typeof window !== "undefined" ? window.scanPilot : null;

export default function TitleBar({
  documentTitle,
  paperSize,
  orientation,
  onSave,
  onUndo,
  onRedo,
  onSettings,
  theme,
  onToggleTheme,
  dirty,
  hasDocument,
  canUndo,
  canRedo,
}: {
  documentTitle: string;
  paperSize: string;
  orientation: "auto" | "portrait" | "landscape";
  onSave: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSettings?: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
  dirty?: boolean;
  hasDocument?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  const orientationLabel =
    orientation === "auto"
      ? "Otomatis"
      : orientation === "landscape"
        ? "Landscape"
        : "Portrait";

  return (
    <header className="ps-titlebar">
      <div className="ps-logo">
        <Printer size={15} />
      </div>
      <div className="ps-quick-access">
        <IconOnly
          title="Simpan (Ctrl+S)"
          icon={Save}
          onClick={onSave}
          disabled={!hasDocument}
        />
        <IconOnly
          title="Urungkan (Ctrl+Z)"
          icon={Undo2}
          onClick={onUndo}
          disabled={!canUndo}
        />
        <IconOnly
          title="Ulangi (Ctrl+Y)"
          icon={Redo2}
          onClick={onRedo}
          disabled={!canRedo}
        />
        <IconOnly title="Pengaturan" icon={Settings} onClick={onSettings} />
        <IconOnly
          title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
          icon={theme === "dark" ? Sun : Moon}
          onClick={onToggleTheme}
        />
      </div>
      <div className="ps-konva-paper-label">
        {paperSize} / {orientationLabel}
      </div>
      <div className="ps-title-center">
        <b>
          {dirty ? "* " : ""}
          {documentTitle}
        </b>
        <span> — PrintStudio</span>
      </div>
      <div className="ps-window-controls">
        <button onClick={() => sp?.minimize()}>
          <Minus size={13} />
        </button>
        <button onClick={() => sp?.maximize()}>
          <Maximize2 size={12} />
        </button>
        <button className="danger" onClick={() => sp?.close()}>
          <X size={13} />
        </button>
      </div>
    </header>
  );
}
