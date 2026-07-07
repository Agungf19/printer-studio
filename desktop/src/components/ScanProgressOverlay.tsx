import { Loader2 } from "lucide-react";
import type { CSSProperties } from "react";

interface ScanProgressOverlayProps {
  visible: boolean;
  status: string;
  pagesScanned: number;
  source: string;
  progress: number;
  title?: string;
  hint?: string;
  pagesLabel?: string;
}

export default function ScanProgressOverlay({
  visible,
  status,
  pagesScanned,
  source,
  progress,
  title = "Memindai...",
  hint = "Jangan mematikan scanner selama proses berlangsung",
  pagesLabel,
}: ScanProgressOverlayProps) {
  if (!visible) return null;

  const isMultiPage =
    source.toLowerCase().includes("feeder") ||
    source.toLowerCase().includes("adf");

  // progress < 0 means indeterminate (real work running, unknown duration).
  const indeterminate = progress < 0;
  const pct = indeterminate
    ? 0
    : Math.max(0, Math.min(100, Math.round(progress)));
  const fillStyle: CSSProperties = indeterminate
    ? {}
    : { transform: `scaleX(${pct / 100})` };

  return (
    <div className="ps-scan-overlay">
      <div className="ps-scan-overlay-box">
        <Loader2 size={40} className="ps-spin" />
        <div className="ps-scan-overlay-title">{title}</div>
        <div className="ps-scan-overlay-status">{status}</div>
        <div
          className={
            indeterminate
              ? "ps-scan-progress indeterminate"
              : "ps-scan-progress"
          }
          role="progressbar"
          aria-valuenow={indeterminate ? undefined : pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="ps-scan-progress-fill" style={fillStyle} />
        </div>
        {!indeterminate && <div className="ps-scan-progress-pct">{pct}%</div>}
        {(pagesLabel || (isMultiPage && pagesScanned > 0)) && (
          <div className="ps-scan-overlay-pages">
            {pagesLabel || `${pagesScanned} halaman berhasil dipindai`}
          </div>
        )}
        <div className="ps-scan-overlay-hint">{hint}</div>
      </div>
    </div>
  );
}
