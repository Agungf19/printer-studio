import {
  Network,
  RefreshCw,
  Wifi,
  Monitor,
  Printer,
  ScanLine,
} from "lucide-react";
import type { NetworkDevice } from "../api/client";
import { StatusDot } from "./RibbonHelpers";

function getDeviceIcon(type: string) {
  switch (type) {
    case "printer":
      return Printer;
    case "scanner":
      return ScanLine;
    case "computer":
      return Monitor;
    default:
      return Wifi;
  }
}

function getStatusTone(type: string): "on" | "busy" | "off" {
  switch (type) {
    case "printer":
    case "scanner":
      return "on";
    case "computer":
      return "busy";
    default:
      return "off";
  }
}

export default function NetworkDevicesModal({
  devices,
  loading,
  onClose,
  onRefresh,
}: {
  devices: NetworkDevice[];
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="ps-overlay open">
      <div
        className="ps-modal"
        role="dialog"
        aria-labelledby="networkTitle"
        style={{ width: 520, maxHeight: "80vh", overflow: "auto" }}
      >
        <h2 id="networkTitle">Perangkat Terhubung di Jaringan</h2>
        <p className="sub">
          Daftar perangkat yang terdeteksi di jaringan lokal.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 12,
          }}
        >
          <button
            className="ps-btn-small"
            onClick={() => void onRefresh()}
            disabled={loading}
          >
            <span className={loading ? "ps-spin" : ""}>
              <RefreshCw size={14} />
            </span>{" "}
            Segarkan
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#7d7a75" }}>
            Memindai jaringan...
          </div>
        ) : devices.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#7d7a75" }}>
            Tidak ada perangkat terdeteksi di jaringan.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {devices.map((device) => {
              const Icon = getDeviceIcon(device.device_type);
              return (
                <div
                  key={device.ip}
                  className="ps-bs-card"
                  style={{ margin: 0 }}
                >
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 7,
                      background: "var(--surface2)",
                      color: "#7d7a75",
                    }}
                  >
                    <Icon size={18} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: 13 }}>
                      {device.hostname}
                    </h3>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 11.5,
                        color: "#7d7a75",
                      }}
                    >
                      {device.ip} ·{" "}
                      {device.device_type === "unknown"
                        ? "Perangkat"
                        : device.device_type.charAt(0).toUpperCase() +
                          device.device_type.slice(1)}
                      {device.shared ? " · Dibagikan" : ""}
                    </p>
                  </div>
                  <StatusDot tone={getStatusTone(device.device_type)} />
                  {getStatusTone(device.device_type) === "off" && (
                    <Icon size={12} style={{ marginLeft: 4, opacity: 0.5 }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="ps-modal-actions">
          <button className="danger" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
