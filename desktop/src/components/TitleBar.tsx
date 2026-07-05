import {
  Minus,
  Maximize2,
  X,
  Printer,
  Save,
  RotateCw,
  RefreshCw,
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import { IconOnly } from "./RibbonHelpers";

const sp = typeof window !== "undefined" ? window.scanPilot : null;

export default function TitleBar({
  documentTitle,
  onSave,
  onSettings,
  theme,
  onToggleTheme,
}: {
  documentTitle: string;
  onSave: () => void;
  onSettings?: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}) {
  return (
    <header className="ps-titlebar">
      <div className="ps-logo">
        <Printer size={15} />
      </div>
      <div className="ps-quick-access">
        <IconOnly title="Simpan (Ctrl+S)" icon={Save} onClick={onSave} />
        <IconOnly title="Urungkan (Ctrl+Z)" icon={RotateCw} />
        <IconOnly title="Ulangi (Ctrl+Y)" icon={RefreshCw} />
        <IconOnly title="Pengaturan" icon={Settings} onClick={onSettings} />
        <IconOnly
          title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
          icon={theme === "dark" ? Sun : Moon}
          onClick={onToggleTheme}
        />
      </div>
      <div className="ps-title-center">
        <b>{documentTitle}</b>
        <span> — ScanPilot Studio</span>
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
