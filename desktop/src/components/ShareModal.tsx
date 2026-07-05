import { useEffect, useState } from "react";
import {
  Network,
  Printer,
  ScanLine,
  StopCircle,
  PlayCircle,
} from "lucide-react";
import {
  api,
  type SharingStatus,
  type PrinterItem,
  type PinInfo,
} from "../api/client";
import { StatusDot } from "./RibbonHelpers";

export default function ShareModal({
  sharing,
  printers,
  onClose,
  onStart,
  onStop,
}: {
  sharing: SharingStatus | null;
  printers: PrinterItem[];
  onClose: () => void;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
}) {
  const [pinInfo, setPinInfo] = useState<PinInfo>({ has_pin: false, pin: "" });
  const [selectedDevice, setSelectedDevice] = useState("printer");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .getPin()
      .then(setPinInfo)
      .catch(() => {});
  }, []);

  const isActive = sharing?.is_active ?? false;
  const onlinePrinters = printers.filter((p) => p.status === "online");

  async function handleToggle() {
    setLoading(true);
    try {
      if (isActive) {
        await onStop();
      } else {
        await onStart();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ps-overlay open">
      <div
        className="ps-modal"
        role="dialog"
        aria-labelledby="shareTitle"
        style={{ width: 480 }}
      >
        <h2 id="shareTitle">
          <Network
            size={18}
            style={{ marginRight: 8, verticalAlign: "middle" }}
          />
          Bagikan ke Jaringan
        </h2>
        <p className="sub">
          Bagikan printer/scanner ke komputer lain di jaringan lokal.
        </p>

        {/* Status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 8,
            background: isActive ? "#e8f5e9" : "var(--soft)",
            border: `1px solid ${isActive ? "#c8e6c9" : "#e6e5e3"}`,
            marginBottom: 16,
            fontSize: 12.5,
          }}
        >
          <StatusDot tone={isActive ? "on" : "off"} />
          <div style={{ flex: 1 }}>
            <strong>{sharing?.hostname || "—"}</strong>
            <span style={{ color: "#7d7a75", marginLeft: 8 }}>
              {sharing?.local_ip || "—"}:{sharing?.port || 8765}
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              padding: "2px 10px",
              borderRadius: 10,
              background: isActive ? "#46a171" : "#e6e5e3",
              color: isActive ? "#fff" : "#7d7a75",
              fontWeight: 600,
            }}
          >
            {isActive ? "AKTIF" : "NONAKTIF"}
          </span>
        </div>

        {/* Device selection */}
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              fontSize: 12,
              color: "#7d7a75",
              display: "block",
              marginBottom: 4,
            }}
          >
            Bagikan
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="ps-btn-small"
              style={{
                background:
                  selectedDevice === "printer"
                    ? "var(--blue)"
                    : "var(--surface2)",
                color: selectedDevice === "printer" ? "#fff" : "var(--text)",
                padding: "6px 14px",
                height: 32,
              }}
              onClick={() => setSelectedDevice("printer")}
            >
              <Printer size={14} /> Printer
            </button>
            <button
              className="ps-btn-small"
              style={{
                background:
                  selectedDevice === "scanner"
                    ? "var(--blue)"
                    : "var(--surface2)",
                color: selectedDevice === "scanner" ? "#fff" : "var(--text)",
                padding: "6px 14px",
                height: 32,
              }}
              onClick={() => setSelectedDevice("scanner")}
            >
              <ScanLine size={14} /> Scanner
            </button>
          </div>
        </div>

        {/* Device info */}
        {selectedDevice === "printer" && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "var(--soft)",
              border: "1px solid var(--border)",
              marginBottom: 14,
              fontSize: 12.5,
            }}
          >
            {onlinePrinters.length === 0 ? (
              <span style={{ color: "#7d7a75" }}>
                Tidak ada printer online.
              </span>
            ) : (
              onlinePrinters.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "3px 0",
                  }}
                >
                  <Printer size={14} />
                  <span>{p.name}</span>
                  <span style={{ color: "#7d7a75", fontSize: 11 }}>
                    {p.connection.replace(/^USB\s*\(|\)$/g, "")}
                  </span>
                  {p.shared && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "#46a171",
                        fontWeight: 600,
                      }}
                    >
                      DIBAGIKAN
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {selectedDevice === "scanner" && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "var(--soft)",
              border: "1px solid var(--border)",
              marginBottom: 14,
              fontSize: 12.5,
            }}
          >
            <ScanLine
              size={14}
              style={{ marginRight: 6, verticalAlign: "middle" }}
            />
            Scanner akan dibagikan ke jaringan. Client bisa scan dari jarak
            jauh.
          </div>
        )}

        {/* Security info */}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--soft)",
            border: "1px solid var(--border)",
            marginBottom: 14,
            fontSize: 12.5,
          }}
        >
          <strong>Keamanan:</strong>{" "}
          {pinInfo.has_pin ? (
            <span style={{ color: "#46a171" }}>
              PIN aktif ({pinInfo.pin}) — client harus PIN ini untuk pairing.
            </span>
          ) : (
            <span style={{ color: "#d5803b" }}>
              PIN belum diatur — semua orang bisa pairing. Atur PIN di menu
              Akses → Kode PIN.
            </span>
          )}
        </div>

        {/* Pairing code */}
        {isActive && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#e5f2fc",
              border: "1px solid #b3d9f2",
              marginBottom: 14,
              fontSize: 12.5,
              textAlign: "center",
            }}
          >
            <span style={{ color: "#7d7a75" }}>Kode Pairing:</span>{" "}
            <strong
              style={{
                fontSize: 18,
                letterSpacing: 4,
                fontFamily: "monospace",
              }}
            >
              {sharing?.pairing_code || "—"}
            </strong>
            <div style={{ color: "#7d7a75", fontSize: 11, marginTop: 4 }}>
              Client: {sharing?.client_count || 0} terhubung
            </div>
          </div>
        )}

        <div className="ps-modal-actions">
          <button className="danger" onClick={onClose}>
            Tutup
          </button>
          <button
            className={isActive ? "danger" : "blue"}
            disabled={loading}
            onClick={() => void handleToggle()}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {loading ? (
              "Memproses..."
            ) : isActive ? (
              <>
                <StopCircle size={14} /> Berhenti Berbagi
              </>
            ) : (
              <>
                <PlayCircle size={14} /> Mulai Berbagi
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
