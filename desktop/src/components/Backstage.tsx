import type { ComponentType } from "react";
import { FileText, Info, Network } from "lucide-react";
import type { SharingStatus } from "../api/client";
import type { ScannedPage } from "../hooks/useFileActions";

function BackstageCard({
  icon: Icon,
  title,
  text,
}: {
  icon: ComponentType<{ size?: number }>;
  title: string;
  text: string;
}) {
  return (
    <div className="ps-bs-card">
      <span>
        <Icon size={22} />
      </span>
      <div>
        <h3>{title}</h3>
        {text.split("\n").map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export default function Backstage({
  onClose,
  onProfileOpen,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExport,
  onPrint,
  hasDocument,
  sharing,
  latestPage,
  backendStatus,
}: {
  onClose: () => void;
  onProfileOpen: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExport: () => void;
  onPrint: () => void;
  hasDocument: boolean;
  sharing: SharingStatus | null;
  latestPage?: ScannedPage;
  backendStatus: string;
}) {
  const items: Array<{
    label: string;
    action: () => void;
    needsDoc?: boolean;
  }> = [
    { label: "Info", action: () => {} },
    { label: "Baru", action: onNew },
    { label: "Buka", action: onOpen },
    { label: "Simpan", action: onSave, needsDoc: true },
    { label: "Simpan Sebagai", action: onSaveAs, needsDoc: true },
    { label: "Ekspor", action: onExport, needsDoc: true },
    { label: "Cetak", action: onPrint, needsDoc: true },
  ];
  return (
    <div className="ps-backstage open">
      <aside className="ps-bs-rail">
        <button className="ps-bs-back" onClick={onClose}>
          ‹ Kembali
        </button>
        {items.map((item, i) => (
          <button
            key={item.label}
            className={i === 0 ? "active" : ""}
            disabled={item.needsDoc && !hasDocument}
            onClick={() => {
              item.action();
              if (i !== 0) onClose();
            }}
          >
            {item.label}
          </button>
        ))}
      </aside>
      <section className="ps-bs-content">
        <h1>Info</h1>
        <BackstageCard
          icon={FileText}
          title={latestPage?.filename || "Belum ada dokumen"}
          text={
            latestPage
              ? "Dipindai dari scanner aktif"
              : "Klik Baru atau Buka untuk mulai."
          }
        />
        <BackstageCard
          icon={Network}
          title="Status Backend"
          text={`Backend: ${backendStatus === "online" ? "Terhubung" : "Offline"} (FastAPI · 127.0.0.1:8765)${sharing?.is_active ? ` · ${sharing.client_count} klien terhubung` : ""}`}
        />
        <BackstageCard
          icon={Info}
          title="Tentang PrintStudio"
          text={
            "PrintStudio v0.2.0\n" +
            "Aplikasi desktop untuk scan, edit, cetak, ekspor, dan berbagi printer, scanner dan dokumen lokal."
          }
        />
      </section>
    </div>
  );
}
