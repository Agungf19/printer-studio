import { useEffect, useState } from "react";
import { Shield, Trash2 } from "lucide-react";
import { api, type PermissionItem } from "../api/client";

export default function PermissionsModal({ onClose }: { onClose: () => void }) {
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newLevel, setNewLevel] = useState("scan+print");

  async function loadPermissions() {
    setLoading(true);
    try {
      const res = await api.permissionsList();
      setPermissions(res.items);
    } catch {
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    try {
      await api.setPermission(newName.trim(), newLevel);
      setNewName("");
      await loadPermissions();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menambah izin");
    }
  }

  async function handleRemove(name: string) {
    try {
      await api.removePermission(name);
      await loadPermissions();
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadPermissions();
  }, []);

  return (
    <div className="ps-overlay open">
      <div
        className="ps-modal"
        role="dialog"
        aria-labelledby="permTitle"
        style={{ width: 480 }}
      >
        <h2 id="permTitle">
          <Shield
            size={18}
            style={{ marginRight: 8, verticalAlign: "middle" }}
          />
          Kelola Izin Akses
        </h2>
        <p className="sub">
          Atur siapa yang boleh mengakses scanner/printer yang dibagikan.
        </p>

        {/* Add new permission */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="Nama client"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{
              flex: 1,
              height: 32,
              padding: "4px 8px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
            }}
            onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
          />
          <select
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value)}
            style={{
              height: 32,
              padding: "4px 8px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            <option value="scan">Scan saja</option>
            <option value="print">Cetak saja</option>
            <option value="scan+print">Scan + Cetak</option>
          </select>
          <button
            className="ps-btn-small"
            style={{
              background: "#2783de",
              color: "#fff",
              padding: "4px 12px",
            }}
            onClick={() => void handleAdd()}
          >
            Tambah
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#7d7a75" }}>
            Memuat...
          </div>
        ) : permissions.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#7d7a75" }}>
            Belum ada izin khusus. Semua client memiliki akses penuh (scan +
            cetak).
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxHeight: 250,
              overflowY: "auto",
            }}
          >
            {permissions.map((perm) => (
              <div
                key={perm.client_name}
                className="ps-bs-card"
                style={{ margin: 0, alignItems: "center" }}
              >
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 13 }}>{perm.client_name}</strong>
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background:
                        perm.level === "scan+print"
                          ? "#e5f2fc"
                          : perm.level === "scan"
                            ? "#e8f5e9"
                            : "#fff3e0",
                      color:
                        perm.level === "scan+print"
                          ? "#2783de"
                          : perm.level === "scan"
                            ? "#46a171"
                            : "#d5803b",
                    }}
                  >
                    {perm.level === "scan+print"
                      ? "Scan + Cetak"
                      : perm.level === "scan"
                        ? "Scan saja"
                        : "Cetak saja"}
                  </span>
                </div>
                <button
                  className="ps-btn-small"
                  style={{ color: "#e56458" }}
                  onClick={() => void handleRemove(perm.client_name)}
                >
                  <Trash2 size={13} /> Hapus
                </button>
              </div>
            ))}
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
