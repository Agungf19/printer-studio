import { Loader2 } from "lucide-react";

export default function ScanProgressOverlay({
  visible,
  status,
  pagesScanned,
  source,
}: {
  visible: boolean;
  status: string;
  pagesScanned: number;
  source: string;
}) {
  if (!visible) return null;

  const isMultiPage =
    source.toLowerCase().includes("feeder") ||
    source.toLowerCase().includes("adf");

  return (
    <div className="ps-scan-overlay">
      <div className="ps-scan-overlay-box">
        <Loader2 size={40} className="ps-spin" />
        <div className="ps-scan-overlay-title">Memindai…</div>
        <div className="ps-scan-overlay-status">{status}</div>
        {isMultiPage && pagesScanned > 0 && (
          <div className="ps-scan-overlay-pages">
            {pagesScanned} halaman berhasil dipindai
          </div>
        )}
        <div className="ps-scan-overlay-hint">
          Jangan mematikan scanner selama proses berlangsung
        </div>
      </div>
    </div>
  );
}
